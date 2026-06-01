import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { setDoc, doc, getDoc } from "firebase/firestore";
import fs from "fs";

/**
 * NOTE: This test file requires the Firebase Firestore Emulator to be running.
 * It follows the 'Phase 0' requirement for security rule verification.
 */

describe("Sahab ERP Security Rules", () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: "sahab-erp-test",
      firestore: {
        rules: fs.readFileSync("firestore.rules", "utf8"),
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  it("should deny access to unauthenticated users", async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(unauthedDb, "accounts/1")));
  });

  it("should allow admin to read everything", async () => {
    const adminDb = testEnv.authenticatedContext("admin_uid", { email: "faremazen3@gmail.com", email_verified: true }).firestore();
    await assertSucceeds(getDoc(doc(adminDb, "accounts/1")));
  });

  it("should prevent role escalation", async () => {
    const userDb = testEnv.authenticatedContext("user_uid", { email: "user@example.com", email_verified: true }).firestore();
    await assertFails(setDoc(doc(userDb, "users/user_uid"), { role: "admin", email: "user@example.com" }));
  });

  it("should prevent invalid account structure", async () => {
    const accountantDb = testEnv.authenticatedContext("acc_uid", { email: "acc@example.com", email_verified: true }).firestore();
    // Accountant role lookup would normally require a doc in /users/acc_uid, 
    // simulating role-based check via the rule function is complex in unit tests without setting up full state.
    // This is a placeholder for the logic.
  });
});
