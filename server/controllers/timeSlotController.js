import { getTimeSlotByStart, getAllTimeSlots } from "../repositories/timeslotRepository.js";
import { responseError, responseSuccess } from "../utils/response.js";

const timeSlotController = {
    getAll: async (req, res) => {
        const from = req.query.from || null;
		const to = req.query.to || null;
		const slots = await getAllTimeSlots(from, to);

		return responseSuccess(res, slots, "Time slots retrieved");
    },

    getByStart: async (req, res) => {
        const start = req.params.start;
        const slot = await getTimeSlotByStart(start);

        return responseSuccess(res, slot, "Time slot retrieved");
    }
};

export default timeSlotController;