import { describe, it , expect, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";
import app from "../../index.js";
import { clear_db, getUserId, initSchema, seed_db, loginAs} from "../helpers/helpers.js"
import db from "../../config/db.js"


describe("GET /api/users/:id",()=>{
    beforeAll(async () => 
        await initSchema()
        
    )

    beforeEach(async () => {
        await clear_db();
        await seed_db();
        
    })

    afterAll( () => {
        db.close()
    })
    it ("401 if not authenticated", async()=>{
        const id = await getUserId("mario.rossi@gmail.com");
        const res = await request(app).get(`/api/users/${id}`)
        expect(res.status).toBe(401);
    })

    it("200 user is authenticated", async () => {

    const user = await loginAs("mario.rossi@gmail.com", "strong_password");
    const id = await getUserId("mario.rossi@gmail.com");
    const res = await user.get(`/api/users/${id}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      fullName: "Mario Rossi",
      email: "mario.rossi@gmail.com",
      role: "WARDEN",
      notes: null,
      phoneNumber: "+39 1234567890",
      emergencyContact: null
    });
    });

    it("hash and password not exposed", async () => {

    const user = await loginAs("mario.rossi@gmail.com", "strong_password");
    const id = await getUserId("mario.rossi@gmail.com");
    const res = await user.get(`/api/users/${id}`);
    expect(res.body.data).not.toHaveProperty("passwordHash");
    expect(res.body.data).not.toHaveProperty("passwordSalt");

  });

  it("401 user doesn't exist", async () => {
    const user = await request(app).post("/api/sessions").send({
        username : "wronguser@gmail.it",
        password : "wrongpassword"
    })
    expect(user.status).toBe(401);

    const res = await request(app).get("/api/sessions/current")
        expect(res.status).toBe(401);
  });
})
    


