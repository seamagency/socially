# Contributing to Socially

Thank you for your interest in contributing to Socially! We welcome contributions from the community. This guide will help you understand how to contribute to the project.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Making Changes](#making-changes)
- [Adding New Platforms](#adding-new-platforms)
- [Testing](#testing)
- [Code Style](#code-style)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Reporting Issues](#reporting-issues)

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/socially.git
   cd socially
   ```
3. **Add upstream remote** to stay synced:
   ```bash
   git remote add upstream https://github.com/seamagency/socially.git
   ```

## Development Setup

### Prerequisites

- Node.js 18+ 
- npm 8+
- TypeScript knowledge
- Git

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build the project:**
   ```bash
   npm run build
   ```

3. **Verify setup:**
   ```bash
   npm test
   ```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript to JavaScript |
| `npm run build:watch` | Compile with watch mode |
| `npm run clean` | Remove the dist folder |
| `npm run test` | Run test suite |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |

## Project Structure

```
socially/
├── src/
│   ├── index.ts                 # Main entry point
│   ├── SocialManager.ts         # Multi-platform manager class
│   ├── types.ts                 # Shared TypeScript interfaces
│   └── platforms/               # Individual platform implementations
│       ├── index.ts
│       ├── Discord.ts
│       ├── Facebook.ts
│       ├── Instagram.ts
│       ├── LinkedIn.ts
│       ├── Pinterest.ts
│       ├── Reddit.ts
│       ├── Slack.ts
│       ├── Telegram.ts
│       ├── Threads.ts
│       ├── TikTok.ts
│       ├── Twitter.ts
│       └── YouTube.ts
├── test/
│   ├── SocialManager.test.ts    # SocialManager tests
│   └── manual-verify.ts         # Manual verification helpers
├── package.json
├── tsconfig.json
├── jest.config.js
└── README.md
```

## Making Changes

### General Workflow

1. **Sync with upstream:**
   ```bash
   git fetch upstream
   git checkout main
   git merge upstream/main
   ```

2. **Create a feature branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```
   Use descriptive branch names (e.g., `feature/add-instagram-reels`, `fix/oauth-token-refresh`)

3. **Make your changes:**
   - Write clean, well-documented code
   - Follow the existing code style
   - Update tests and documentation

4. **Keep your branch up to date:**
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

## Adding New Platforms

### Steps to Add a New Platform

1. **Create a platform file** in `src/platforms/NewPlatform.ts`:

```typescript
import { SocialPlatform, PostContent, Analytics } from '../types';

export class NewPlatform implements SocialPlatform {
    private accessToken: string;
    private config: any;

    constructor(config: any) {
        this.config = config;
        this.accessToken = config.accessToken;
    }

    async post(content: PostContent): Promise<{ id: string; url: string }> {
        // Implementation here
        throw new Error('Not implemented');
    }

    async getAnalytics(postId: string): Promise<Analytics> {
        // Implementation here
        throw new Error('Not implemented');
    }

    // Implement other required interface methods
}
```

2. **Update `src/platforms/index.ts`:**
   ```typescript
   export { NewPlatform } from './NewPlatform';
   ```

3. **Update `src/types.ts`** if you need custom types for the platform

4. **Update `src/SocialManager.ts`** to support the new platform

5. **Add unit tests** in `test/` directory

6. **Update `README.md`** to include the new platform in the supported platforms table

### Platform Requirements

Each platform must implement the `SocialPlatform` interface:

```typescript
interface SocialPlatform {
    post(content: PostContent): Promise<{ id: string; url: string }>;
    getAnalytics(postId: string): Promise<Analytics>;
    // Other methods as needed
}
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- SocialManager.test.ts
```

### Writing Tests

- Place tests in the `test/` directory
- Use Jest as the testing framework
- Follow the naming convention: `*.test.ts`
- Test both happy paths and error cases

Example test:

```typescript
describe('NewPlatform', () => {
    let platform: NewPlatform;

    beforeEach(() => {
        platform = new NewPlatform({
            accessToken: 'test-token'
        });
    });

    it('should post content successfully', async () => {
        const result = await platform.post({
            text: 'Test post'
        });
        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('url');
    });

    it('should throw error on invalid content', async () => {
        await expect(platform.post({ text: '' })).rejects.toThrow();
    });
});
```

## Code Style

### TypeScript Guidelines

- Use **strict mode** - all TypeScript files must compile with strict type checking
- Use **proper typing** - avoid `any` types when possible
- Use **interfaces** for public APIs
- Use **classes** for implementations
- **Document public APIs** with JSDoc comments

### Naming Conventions

- **Classes:** `PascalCase` (e.g., `Instagram`, `SocialManager`)
- **Functions/Methods:** `camelCase` (e.g., `post`, `getAnalytics`)
- **Constants:** `UPPER_SNAKE_CASE` (e.g., `API_VERSION`)
- **Interfaces:** `PascalCase` with I prefix optional (e.g., `SocialPlatform`)

### Example Code Style

```typescript
/**
 * Posts content to the social media platform
 * @param content - The content to post
 * @returns Object containing post ID and URL
 */
async post(content: PostContent): Promise<{ id: string; url: string }> {
    // Validate input
    if (!content.text && !content.media?.length) {
        throw new Error('Post must contain text or media');
    }

    // Implementation
    const response = await this.api.post('/posts', content);
    return {
        id: response.id,
        url: response.url
    };
}
```

### Format Code

Run Prettier before committing:

```bash
npm run format
```

## Commit Guidelines

### Commit Message Format

Follow conventional commits:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat:** New feature
- **fix:** Bug fix
- **docs:** Documentation changes
- **style:** Code style changes (formatting, semicolons, etc.)
- **refactor:** Code refactoring without feature changes
- **perf:** Performance improvements
- **test:** Adding or updating tests
- **chore:** Dependency updates, build system changes

### Examples

```
feat(instagram): add support for carousel posts

Implement carousel post functionality with up to 10 images/videos
per post. Includes proper error handling for unsupported media types.

Fixes #123
```

```
fix(oauth): handle token refresh correctly

The previous implementation was not properly handling expired tokens
during concurrent requests. Now uses proper token locking mechanism.

Fixes #456
```

## Pull Request Process

### Before Creating a PR

1. **Ensure tests pass:**
   ```bash
   npm test
   ```

2. **Ensure code is formatted:**
   ```bash
   npm run format
   ```

3. **Update documentation:**
   - Update `README.md` if adding features
   - Add JSDoc comments for public APIs
   - Update `socially.md` if behavior changes

4. **Sync with main:**
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

### Creating a PR

1. **Push to your fork:**
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Open a PR on GitHub** with:
   - Clear title describing the change
   - Description of what changed and why
   - Reference to related issues (e.g., `Fixes #123`)
   - Screenshots or examples if applicable

### PR Description Template

```markdown
## Description
Brief description of the changes

## Type of Change
- [ ] New feature
- [ ] Bug fix
- [ ] Documentation update
- [ ] Breaking change

## Related Issues
Fixes #(issue number)

## Testing
Describe how you tested this change

## Checklist
- [ ] Tests pass locally
- [ ] Code is formatted with `npm run format`
- [ ] Documentation is updated
- [ ] Commit messages follow guidelines
```

### Review Process

- Maintainers will review your PR
- Address feedback promptly
- Rebase and force push only if requested
- Once approved, maintainers will merge

## Reporting Issues

### Before Reporting

- Check if the issue already exists
- Test with the latest version
- Provide minimal reproducible example

### Issue Template

When opening an issue, include:

1. **Description:** What is the problem?
2. **Steps to Reproduce:** How to reproduce the issue?
3. **Expected Behavior:** What should happen?
4. **Actual Behavior:** What actually happens?
5. **Environment:**
   - Node version
   - OS
   - Socially version
6. **Code Example:** Minimal code that demonstrates the issue

Example:

```markdown
## Description
Instagram OAuth token refresh is failing

## Steps to Reproduce
1. Create Instagram instance with refresh token
2. Wait for token to expire
3. Call any API method

## Expected Behavior
Token should refresh automatically

## Actual Behavior
Throws "Invalid token" error

## Environment
- Node: 18.16.0
- OS: macOS
- Socially: 1.1.3
```

## Questions or Need Help?

- Open an issue on GitHub
- Check existing issues and documentation
- Review the `socially.md` documentation

## License

By contributing to Socially, you agree that your contributions will be licensed under its MIT License.

---

**Thank you for contributing to Socially!** 🎉
