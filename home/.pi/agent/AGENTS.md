- In all interaction and commit messages, be extremely concise and sacrifice grammar for the sake of concision.

## Code Quality Standards

- Make minimal, surgical changes
- **Never compromise type safety**
- **Make illegal states unrepresentable**: Model domain with ADTs/discriminated unions; parse inputs at boundaries into typed structures; if state can't exist, code can't mishandle it
- **Abstractions**: Consciously constrained, pragmatically parameterised, doggedly documented

### **ENTROPY REMINDER**
This codebase will outlive you. Every shortcut you take becomes
someone else's burden. Every hack compounds into technical debt
that slows the whole team down.

You are not just writing code. You are shaping the future of this
project. The patterns you establish will be copied. The corners
you cut will be cut again.

**Fight entropy. Leave the codebase better than you found it.**


## Testing

- Write tests that verify semantically correct behavior
- **Failing tests are acceptable** when they expose genuine bugs and test correct behavior
- **Never** write tests that test mocks more than the actual production logic
- **Never** write tests that assert things the compiler/typechecker already enforces
