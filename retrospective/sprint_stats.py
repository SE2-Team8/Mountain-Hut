import pandas as pd
import math


def minutes_to_str(minutes):
	hours_f = minutes / 60.0
	minutes_f, hours_int = math.modf(hours_f)
	_, minutes_int = math.modf(minutes_f * 60.0)
	return f"{int(hours_int)}h {int(minutes_int)}m"

# extracts the total estimated and actual time spent for tasks where the title contains the given keyword
def print_time_for_tasks(task_keyword, title):
	tasks = df[df["Summary"].str.contains(task_keyword, case=False, na=False)]
	estimate = tasks["Estimation"]
	actual = tasks["Spent time"]
	print(f"{title} stats: total estimate = {minutes_to_str(estimate.sum())}, total actual = {minutes_to_str(actual.sum())}")


file_name = "Issues.csv"
sprint = "Sprint 1"

# load data, considering only some completed tasks for the selected sprint
df = pd.read_csv(file_name, encoding="utf-8-sig")
df = df[(df["Type"] == "Task") & (df["Sprints"] == sprint) & (df["State"] == "Done")]


# # convert time fields in hours
# minute_cols = ["Estimation per person", "Spent time", "Estimation"]
# for c in minute_cols:
#     df[c] = pd.to_numeric(df[c], errors="coerce").fillna(0) # strings/blank -> NaN -> 0
#     df[c] = df[c] / 60 
df.fillna(0, inplace=True)

# add and remove some columns
df["Number of Assignees"] = df["Assignee"].str.count(",") + 1
df["Normalized Estimation"] = df["Estimation"] / df["Number of Assignees"]
df["Normalized Spent time"] = df["Spent time"] / df["Number of Assignees"]
df = df.drop(columns=[
	"Project", "Tags", "Votes", "Priority", "Updated", "Created", "Resolved",
	"Description", "Story points", "Original estimation", "State",
	"Ideal days", "Type", "Sprints", "Assignee", "Reporter", "Estimation per person", "Hours per person"
	], errors="ignore")


# display options
pd.set_option("display.max_columns", None)
pd.set_option("display.width", 200)
print("*" * 50, f"Completed tasks for sprint '{sprint}'", "*" * 50)
print(df)

# stats calculation
print("*" * 50, "Tasks statistics", "*" * 50)
# estimated time per task (per person)
col = df["Normalized Estimation"]
print(f"Estimated time per task per person: mean = {minutes_to_str(col.mean())}, std = {minutes_to_str(col.std())}")

# actual time per task (per person)
col = df["Normalized Spent time"]
print(f"Actual time per task per person: mean = {minutes_to_str(col.mean())}, std = {minutes_to_str(col.std())}")

# total estimation error
est_err = (df["Spent time"].sum() / df["Estimation"].sum()) - 1
print(f"Total task estimation error: {est_err:.2f}")

# relative estimation error
rel_est_err = (df["Spent time"] / df["Estimation"] - 1).abs().mean()
print(f"Relative task estimation error: {rel_est_err:.2f}")

# time of testing and review
print("*" * 50, "Testing and code review", "*" * 50)
print_time_for_tasks("Unit test", "Unit Testing")
print_time_for_tasks("Integration test", "Integration Testing")
print_time_for_tasks("E2E test", "End to End Testing")
print_time_for_tasks("Code review", "Code Review")
