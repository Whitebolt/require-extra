## Things for future versions

1. Provide options to replace the require methods within loaded modules so all dependancies load aschronously.
2. Provide and options object to the require() and resolve() methods giving the user control over module scopes.
3. Tidy and improve the getModule() method:
 * Add ability to load multiple modules like require().
 * Syntax is a bit messey, ensure it feel consistant with other methods.
 * Add node-style callbacks.
4. Ensure module resolving with with new NPM directory structures.
5. Add node-style callbacks to resolve().
6. Add mocha tests! These should have been in from start.

## Possible features

1. Ability to optionally load modules in-sequence; hence, avoiding any cache race style ineffciencies.
2. Tackle potential cache race by reworking the internal code evaling.
3. Add an on() method for loading events (like requireJs).
4. Add plugin support
