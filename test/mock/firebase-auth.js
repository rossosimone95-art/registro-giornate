const U = JSON.parse(localStorage.getItem("mockUser") || "null");
export function getAuth() { return { currentUser: U }; }
export function onAuthStateChanged(a, cb) { setTimeout(() => cb(U), 10); }
export class GoogleAuthProvider { setCustomParameters() {} }
export const signInWithPopup = async () => {}, signInWithRedirect = async () => {}, getRedirectResult = async () => null, signOut = async () => { localStorage.removeItem("mockUser"); };
export const signInWithEmailAndPassword = async () => {}, createUserWithEmailAndPassword = async () => ({ user: U }), sendPasswordResetEmail = async () => {}, sendEmailVerification = async () => {};
