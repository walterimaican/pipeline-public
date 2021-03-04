/* Only checks for environment variable's existence, not its value! */
if (process.env.SUPPRESS_CONSOLE_DURING_TESTING) {
    console._stdout.write = jest.fn();
    console.log = jest.fn();
    console.error = jest.fn();
}
