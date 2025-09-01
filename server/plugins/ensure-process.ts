/** Below code suppresses the tree shaking error below:
 * [WARNING] Ignoring this import because "../node_modules/@cloudflare/unenv-preset/dist/runtime/node/process.mjs" was marked as having no side effects [ignored-bare-import]
 */
export default () => {
    // Touching process ensures the shim isn't tree-shaken as a "side-effect-only" import
    if (typeof process !== 'undefined' && process.versions) {
        // no-op; just a live read
        void process.versions.node;
    }
};
