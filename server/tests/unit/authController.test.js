import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../utils/response.js", () => ({ responseSuccess: vi.fn(), responseError: vi.fn() }));
vi.mock("../../services/smtpService.js", () => ({ sendTemplateEmail: vi.fn() }));
vi.mock("../../repositories/userRepository.js", () => ({
    createHiker: vi.fn(),
    getUserById: vi.fn(),
    getUserFromEmail: vi.fn(),
    getUserFromCredentials: vi.fn(),
    updatePassword: vi.fn()
}));

import { responseError, responseSuccess } from "../../utils/response";
import authController from "../../controllers/authController";
import { createHiker, getUserById, getUserFromCredentials, getUserFromEmail, updatePassword } from "../../repositories/userRepository";
import { sendTemplateEmail } from "../../services/smtpService";

const baseUser = {
    userId: 17,
    role: "HIKER",
    fullName: "Mario Rossi",
    email: "mario@example.com",
    phoneNumber: "+393331234567",
    notes: "vegetariano",
    emergencyContact: null,
    mustChangePassword: false
};

beforeEach(() => vi.clearAllMocks());

describe("authController.register", () => {

    it("regisration succeded", async () => {

        const req = {
            body: {
                email: "monster@libero.it",
                password: "my_password",
                fullName: "Mike Wasoski",
                phone: "+391231231212",
                notes: "",
                emergencyContact: "",
            },
            login: vi.fn((user, cb) => cb(null)),
        };

        const res = {};

        getUserFromEmail.mockResolvedValue(null);
        createHiker.mockResolvedValue(17);
        getUserById.mockResolvedValue(baseUser);

        await authController.register(req, res);

        expect(getUserFromEmail).toHaveBeenCalledWith("monster@libero.it");
        expect(createHiker).toHaveBeenCalledWith(
            "Mike Wasoski",
            "monster@libero.it",
            "+391231231212",
            null,
            null,
            "my_password"
        );
        expect(getUserById).toHaveBeenCalledWith(17);
        expect(req.login).toHaveBeenCalledWith(baseUser, expect.any(Function));
        expect(responseSuccess).toHaveBeenCalledWith(res, baseUser, expect.any(String), 201);
    });

    it("error - another user <lready exist with that email", async () => {

        const req = {
            body: {
                email: "monster@libero.it",
                password: "my_password",
                fullName: "Mike Wasoski",
                phone: "+391231231212",
                notes: "",
                emergencyContact: "",
            },
            login: vi.fn(),
        };

        const res = {};

        getUserFromEmail.mockResolvedValue(baseUser);

        await authController.register(req, res);

        expect(getUserFromEmail).toHaveBeenCalledWith("monster@libero.it");
        expect(responseError).toHaveBeenCalledWith(res, null, expect.any(String), 409);
        expect(createHiker).not.toHaveBeenCalled();
        expect(getUserById).not.toHaveBeenCalled();
        expect(req.login).not.toHaveBeenCalled();
        expect(responseSuccess).not.toHaveBeenCalled();
    });

    it("error - throws an error if automatic login fails", async () => {

        const req = {
            body: {
                email: "monster@libero.it",
                password: "my_password",
                fullName: "Mike Wasoski",
                phone: "+391231231212",
                notes: "",
                emergencyContact: "",
            },
            login: vi.fn((user, cb) => cb(new Error("Passport error"))),
        };

        const res = {};

        getUserFromEmail.mockResolvedValue(null);
        createHiker.mockResolvedValue(17);
        getUserById.mockResolvedValue(baseUser);

        await expect(authController.register(req, res)).rejects.toThrow(
            "Error during automatic login"
        );
        expect(responseSuccess).not.toHaveBeenCalled();
    });
});

describe("authController.login", () => {

     it("login successfull", () => {

        const req = { user: baseUser };

        const res = {};

        authController.login(req, res);

        expect(responseSuccess).toHaveBeenCalledWith(res, baseUser, expect.any(String));
     });
});

describe ("authController.logout", () => {

    it ("logout successfull", () => {

        const req = { logout: vi.fn((cb) => cb()) };

        const res = {};

        authController.logout(req, res);

        expect(req.logout).toHaveBeenCalledTimes(1);
        expect(responseSuccess).toHaveBeenCalledWith(res, null, expect.any(String));
    });
});

describe ("authController.getCurrent", () => {

    it ("returns the current user when authenticated", () => {

        const req = { user: baseUser };

        const res = {};

        authController.getCurrent(req, res);

        expect(responseSuccess).toHaveBeenCalledWith(res, baseUser, expect.any(String));
        expect(responseError).not.toHaveBeenCalled();
    });

    it("returns 401 when no user is authenticated", () => {

        const req = { user: null };

        const res = {};

        authController.getCurrent(req, res);

        expect(responseError).toHaveBeenCalledWith(res, null, expect.any(String), 401);
        expect(responseSuccess).not.toHaveBeenCalled();
    })
});

describe("authController.changePassword", () => {

    it("changes succesfully the password and sends the email", async () => {

        const req = {
            body: { currentPassword: "oldPassword", newPassword: "newPassword" },
            user: baseUser,
            login: vi.fn((user, cb) => cb(null))
        };

        const res = {};

        getUserFromCredentials.mockResolvedValue(baseUser);
        updatePassword.mockResolvedValue(true);
        getUserById.mockResolvedValue(baseUser);
        sendTemplateEmail.mockResolvedValue();

        await authController.changePassword(req, res);

        expect(responseError).not.toHaveBeenCalled();
        expect(getUserFromCredentials).toHaveBeenCalledWith(baseUser.email, req.body.currentPassword);
        expect(updatePassword).toHaveBeenCalledWith(17, req.body.newPassword);
        expect(getUserById).toHaveBeenCalledWith(17);
        expect(sendTemplateEmail).toHaveBeenCalledWith({
            to: baseUser.email,
            subject: "Your password has been changed",
            templateName: "password-changed",
            data: {
                user: { fullName: baseUser.fullName },
                changedAt: expect.any(String),
            },
            text: "The password of your Mountain Hut account has been changed."
        });
        expect(req.login).toHaveBeenCalledWith(baseUser, expect.any(Function));
        expect(responseSuccess).toHaveBeenCalledWith(res, null, expect.any(String));
    });

    it("still succeeds if sending the email fails", async () => {

        const req = {
            body: { currentPassword: "oldPassword", newPassword: "newPassword" },
            user: baseUser,
            login: vi.fn((user, cb) => cb(null))
        };

        const res = {};

        getUserFromCredentials.mockResolvedValue(baseUser);
        updatePassword.mockResolvedValue(true);
        getUserById.mockResolvedValue(baseUser);
        sendTemplateEmail.mockRejectedValue(new Error("SMTP down"));
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        await authController.changePassword(req, res);

        expect(consoleSpy).toHaveBeenCalled();
        expect(responseError).not.toHaveBeenCalled();
        expect(getUserFromCredentials).toHaveBeenCalledWith(baseUser.email, req.body.currentPassword);
        expect(updatePassword).toHaveBeenCalledWith(17, req.body.newPassword);
        expect(getUserById).toHaveBeenCalledWith(17);
        expect(req.login).toHaveBeenCalledWith(baseUser, expect.any(Function));
        expect(responseSuccess).toHaveBeenCalledWith(res, null, expect.any(String));

        consoleSpy.mockRestore();
    });

    it("returns 422 if newPassword and currentPassword are the same", async () => {

        const req = {
            body: { currentPassword: "password", newPassword: "password" },
            user: baseUser,
            login: vi.fn()
        };

        const res = {};

        await authController.changePassword(req, res);

        expect(responseError).toHaveBeenCalledWith(res, null, expect.any(String), 422);
        expect(updatePassword).not.toHaveBeenCalled();
        expect(getUserById).not.toHaveBeenCalled();
        expect(sendTemplateEmail).not.toHaveBeenCalled();
        expect(req.login).not.toHaveBeenCalled();
        expect(responseSuccess).not.toHaveBeenCalled();
    });

    it("returns 403 if currentPassword is wrong", async () => {

        const req = {
            body: { currentPassword: "wrongPassword", newPassword: "newPassword" },
            user: baseUser,
            login: vi.fn()
        };

        const res = {};

        getUserFromCredentials.mockResolvedValue(null);

        await authController.changePassword(req, res);

        expect(responseError).toHaveBeenCalledWith(res, null, expect.any(String), 403);
        expect(getUserFromCredentials).toHaveBeenCalledWith(baseUser.email, req.body.currentPassword);
        expect(updatePassword).not.toHaveBeenCalled();
        expect(getUserById).not.toHaveBeenCalled();
        expect(sendTemplateEmail).not.toHaveBeenCalled();
        expect(req.login).not.toHaveBeenCalled();
        expect(responseSuccess).not.toHaveBeenCalled();
    });

    it("returns 500 if updating the session fails", async () => {

        const req = {
            body: { currentPassword: "oldPassword", newPassword: "newPassword" },
            user: baseUser,
            login: vi.fn((user, cb) => cb(new Error("Session error"))),
        };

        const res = {};

        getUserFromCredentials.mockResolvedValue(baseUser);
        updatePassword.mockResolvedValue(true);
        getUserById.mockResolvedValue(baseUser);
        sendTemplateEmail.mockResolvedValue();

        await authController.changePassword(req, res);

        expect(responseError).toHaveBeenCalledWith(res, null, expect.any(String), 500);
        expect(getUserFromCredentials).toHaveBeenCalled();
        expect(updatePassword).toHaveBeenCalled();
        expect(getUserById).toHaveBeenCalled();
        expect(sendTemplateEmail).toHaveBeenCalled();
        expect(req.login).toHaveBeenCalled();
        expect(responseSuccess).not.toHaveBeenCalled();
    });
});