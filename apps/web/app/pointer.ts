// A mouse or trackpad. Fields focus themselves only then; on phones it would pop up the keyboard.
export const hasFinePointer = () => window.matchMedia("(pointer: fine)").matches;
