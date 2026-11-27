import { describe, it, expect, beforeEach, afterAll, vi, beforeAll } from "vitest";
import request from "supertest";
import app from "../../index.js"
import db from "../../config/db.js";
import { initSchema, resetDb, loginAsRole } from "../helpers/helpers.js";
import { sendTemplateEmail } from "../../services/smtpService.js";

vi.mock("../../services/smtpService.js", () => ({
  sendTemplateEmail: vi.fn().mockResolvedValue(),
}));

beforeAll(initSchema);
beforeEach(async () => {
    vi.clearAllMocks();
    await resetDb();
});
afterAll(() => db.close());

describe("POST /api/auth/change-password", () => {

    it("happy path", async () => {

        const agent = await loginAsRole("hiker2");
        const res = await agent.post("/api/auth/change-password").send({ currentPassword: process.env.SEED_USER_PWD, newPassword: "mantide_religiosa" });

        expect(res.status).toBe(200);
        expect(res.body.success).toBeTruthy();
        expect(res.body.message).toBe("Password successfully changed");
        expect(sendTemplateEmail).toHaveBeenCalledTimes(1);

        const oldLogin = await request(app).post("/api/auth/login").send({ username: "gio.ilMucia@gmail.com", password: process.env.SEED_USER_PWD });
        expect(oldLogin.status).toBe(401);

        const newLogin = await request(app).post("/api/auth/login").send({ username: "gio.ilMucia@gmail.com", password: "mantide_religiosa" });
        expect(newLogin.status).toBe(200);
    });

    it ("unauthorized request", async () => {

        const res = await request.agent(app).post("/api/auth/change-password").send({ currentPassword: process.env.SEED_USER_PWD, newPassword: "mantide_religiosa" });

        expect(res.status).toBe(401);
        expect(res.body.success).toBeFalsy();
    });

    it("forbidden, current password is wrong", async () => {

        const agent = await loginAsRole("hiker2");
        const res = await agent.post("/api/auth/change-password").send({ currentPassword: "wrong_password", newPassword: "mantide_religiosa" });

        expect(res.status).toBe(403);
        expect(res.body.success).toBeFalsy();
    });

    it("business rule not respected: current and new passwords are the same", async () => {

        const agent = await loginAsRole("hiker2");
        const res = await agent.post("/api/auth/change-password").send({ currentPassword: process.env.SEED_USER_PWD, newPassword: process.env.SEED_USER_PWD });

        expect(res.status).toBe(422);
        expect(res.body.success).toBeFalsy();
    });

    it("the forbidden error should have the priority", async () => {

        const agent = await loginAsRole("hiker2");
        const res = await agent.post("/api/auth/change-password").send({ currentPassword: "wrong_password", newPassword: "wrong_password" });

        expect(res.status).toBe(403);
        expect(res.body.success).toBeFalsy();
    });

    it.each([
        ["currentPassword is absent", { newPassword: "mantide_religiosa" }],
        ["newPassword is absent", { currentPassword: process.env.SEED_USER_PWD }],
        ["currentPassword is not a string", { currentPassword: 1234, newPassword: "mantide_religiosa" }],
        ["newPassword is not a string", { currentPassword: process.env.SEED_USER_PWD, newPassword: 1234 }],
        ["currentPassword is empty", { currentPassword: "", newPassword: "mantide_religiosa" }],
        ["newPassword is empty", { currentPassword: process.env.SEED_USER_PWD, newPassword: "" }],
        ["newPassword is all blank spaces", { currentPassword: process.env.SEED_USER_PWD, newPassword: "     " }],
        ["newPassword too short", { currentPassword: process.env.SEED_USER_PWD, newPassword: "short"}],
        ["newPassword too long", { currentPassword: process.env.SEED_USER_PWD, newPassword: "veryveryveryveryveryveryveryveryveryveryveryveryveryveryveryveryveryveryveryveryveryveryveryveryveryveryveryveryveryveryveryverylong"}],
        ["extra field is present", { currentPassword: process.env.SEED_USER_PWD, newPassword: "mantide_religiosa", extra: "abc" }]
    ])("422 for %s", async (_label, body) => {
        const agent = await loginAsRole("hiker2");
        const res = await agent.post("/api/auth/change-password").send(body);

        expect(res.status).toBe(422);
        expect(res.body.success).toBeFalsy();
    });
});