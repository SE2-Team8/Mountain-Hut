import { getTimeSlotByStart, checkSlotAvailability, getAllTimeSlots, getTimeSlotById, createTimeSlot } from "../repositories/timeSlotRepository.js";
import { responseError, responseSuccess } from "../utils/response.js";


const timeSlotController = {
    getAll: async (req, res) => {
        const from = req.query.from || null;
		const to = req.query.to || null;
		const slots = await getAllTimeSlots(from, to);

		return responseSuccess(res, slots, "Time slots retrieved");
    },

    getByStart: async (req, res) => {
        const start = req.params.start instanceof Date ? req.params.start : new Date(req.params.start);
        const slot = await getTimeSlotByStart(start);
        if (!slot) return responseError(res, null, `Time slot starting on ${start} not found`, 404);

        return responseSuccess(res, slot, "Time slot retrieved");
    },

    getByStartAndPartySize: async (req, res) => {
        const start = req.query.start instanceof Date ? req.query.start : new Date(req.query.start);
        const slot = await getTimeSlotByStart(start);
        if (!slot) return responseError(res, null, `Time slot starting on ${start} not found`, 404);
        else{
            const configuration = await checkSlotAvailability(slot.timeSlotId, req.query.partySize);
            return responseSuccess(res, configuration, "Configuration Retrived")
        }
    },

    create: async (req, res) => {
        const { startDateTime, endDateTime, tables, copyFromTimeSlotId } = req.body;
        const from = new Date(startDateTime);
        const to = new Date(endDateTime);

        if (from.getTime() < Date.now())
            return responseError(res, null, "A time slot cannot start in the past", 400);

        if (copyFromTimeSlotId !== undefined) { // if the employee chooses to copy, the source slot must exist
            const source = await getTimeSlotById(copyFromTimeSlotId);
            if (!source)
                return responseError(res, null, `Time slot ${copyFromTimeSlotId} not found`, 404)
        }

        const existing = await getTimeSlotByStart(from);
        if (existing)   // no other slot can start at same time
            return responseError(res, null, `A time slot starting at that time already exists`, 409)

        const startTime = from.getTime();
        const endTime = to.getTime();
        const slots = await getAllTimeSlots();
        if (slots && slots.length > 0){
            let slotOverlap = null;
            for (let s of slots){
                if (s.endDateTime.getTime() > startTime && s.startDateTime.getTime() < endTime) {
                    slotOverlap = s.timeSlotId;
                };
            }
            if (slotOverlap !== null) return responseError(res, null, `There is an overlap with time slot ${slotOverlap}`, 409);
        }

        try {
            const timeSlotId = await createTimeSlot(from, to, tables ?? null, copyFromTimeSlotId ?? null);
            return responseSuccess(res, { timeSlotId }, "Time slot created", 201);
        } catch (err) {
            if (err.code === "SQLITE_CONSTRAINT" && /startDateTime/.test(err.message))
                return responseError(res, null, "A time slot starting at that time already exists", 409);
            throw err;
        }
    }
};

export default timeSlotController;