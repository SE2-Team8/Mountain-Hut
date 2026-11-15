import { create } from "zustand";

const usePageStore = create((set, get) => ({
	// dictionary where key = route, value = json object
	data: {},

	// read
	getPageData: (route) => get().data[route],

	// set
	setPageData: (route, value) =>
	set((s) => ({
		data: { ...s.data, [route]: value },
	})),

	// add fields into an existing route object
	addPageData: (route, partial) =>
	set((s) => ({
		data: {
		...s.data,
		[route]: { ...(s.data[route] ?? {}), ...partial },
		},
	})),

	// delete (one)
	deletePageData: (route) =>
	set((s) => {
		const { [route]: _, ...rest } = s.data;
		return { data: rest };
	}),

	// delete all
	reset: () => set({ data: {} }),
}));

export default usePageStore;