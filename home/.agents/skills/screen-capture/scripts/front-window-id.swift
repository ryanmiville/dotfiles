#!/usr/bin/env swift

import AppKit
import CoreGraphics
import Foundation

func fail(_ message: String, code: Int32 = 1) -> Never {
    FileHandle.standardError.write(Data("screen-capture: \(message)\n".utf8))
    exit(code)
}

guard CGPreflightScreenCaptureAccess() else {
    fail(
        "Screen Recording permission is missing; grant it to the host application, then quit and reopen that application",
        code: 77
    )
}

if CommandLine.arguments.dropFirst().first == "--check" {
    exit(0)
}

let requestedApp: String? = {
    let arguments = Array(CommandLine.arguments.dropFirst())
    guard !arguments.isEmpty else { return nil }
    guard arguments.count == 2, arguments[0] == "--app" else {
        fail("usage: front-window-id.swift [--check | --app APP_NAME]")
    }
    return arguments[1]
}()

let frontmostPID = NSWorkspace.shared.frontmostApplication?.processIdentifier
let options: CGWindowListOption = [.optionOnScreenOnly, .excludeDesktopElements]
let windows = CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]] ?? []

for window in windows {
    guard
        let id = window[kCGWindowNumber as String] as? CGWindowID,
        let owner = window[kCGWindowOwnerName as String] as? String,
        let pid = window[kCGWindowOwnerPID as String] as? pid_t,
        let layer = window[kCGWindowLayer as String] as? Int,
        let boundsDictionary = window[kCGWindowBounds as String] as? NSDictionary,
        let bounds = CGRect(dictionaryRepresentation: boundsDictionary),
        layer == 0,
        bounds.width > 1,
        bounds.height > 1
    else {
        continue
    }

    let matches = if let requestedApp {
        owner.localizedCaseInsensitiveCompare(requestedApp) == .orderedSame
    } else {
        pid == frontmostPID
    }

    if matches {
        print(id)
        exit(0)
    }
}

if let requestedApp {
    fail("no visible window found for application '\(requestedApp)'")
} else {
    fail("no visible window found for the frontmost application")
}
