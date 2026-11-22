import pandas as pd
import math
import sys

# converts a floating point number of minutes into the typical display w d h m
def minutes_to_str(minutes):
	# weeks_f = minutes / (60.0 * 8.0 * 5.0)
	# days_f, weeks_int = math.modf(weeks_f)
	# hours_f, days_int = math.modf(days_f * 5.0)
	# minutes_f, hours_int = math.modf(hours_f * 8.0)
	minutes_f, hours_int = math.modf(minutes / 60.0)
	seconds_f, minutes_int = math.modf(minutes_f * 60.0)
	parts = [
        # (int(weeks_int),   'w'),
        # (int(days_int),    'd'),
        (int(hours_int),   'h'),
        (int(minutes_int), 'm'),
    ]
	result = " ".join(f"{v}{s}" for v, s in parts if v)
	return result or "0m"

# extracts the total estimated and actual time spent for tasks where the title contains the given keyword
def print_time_for_tasks(task_keyword, title):
	tasks = df[df["Summary"].str.contains(task_keyword, case=False, na=False)]
	estimate = tasks["Estimation"]
	actual = tasks["Spent time"]
	print(f"{title} stats: total estimate = {minutes_to_str(estimate.sum())}, total actual = {minutes_to_str(actual.sum())}")


# main
args = sys.argv
if len(args) < 3:
	print("Wrong arguments provided: required fileName.csv (must be a .csv, i.e. \"Issues.csv\") and Sprint filter (can contain spaces, i.e. \"Sprint 1\")")
	exit(1)

file_name = args[1]
sprint_filter = " ".join(args[2:])

print(f"Processing file \"{file_name}\" with sprint filter \"{sprint_filter}\"")

# load data, considering only some completed tasks for the selected sprint
df = pd.read_csv(file_name, encoding="utf-8-sig")
df = df[(df["Type"] == "Task") & (df["Sprints"] == sprint_filter) & (df["State"] == "Done")]

# set NaNs to 0s
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
print("*" * 50, f"Completed tasks for sprint '{sprint_filter}'", "*" * 50)
print(df)

# stats calculation
print("*" * 50, "General statistics", "*" * 50)
# total estimated time
col = df["Estimation"]
print(f"Estimated total time: = {minutes_to_str(col.sum())}")
# total spent time
col = df["Spent time"]
print(f"Total time spent: = {minutes_to_str(col.sum())}")

print("*" * 50, "Tasks statistics", "*" * 50)
# estimated time per task (per person)
col = df["Normalized Estimation"]
print(f"Estimated time per task per person: mean = {minutes_to_str(col.mean())}, std = {minutes_to_str(col.std())}")

# actual time per task (per person)
col = df["Normalized Spent time"]
print(f"Actual time per task per person: mean = {minutes_to_str(col.mean())}, std = {minutes_to_str(col.std())}")

# total estimation error
est_err = (df["Estimation"].sum() / df["Spent time"].sum()) - 1
print(f"Total task estimation error: {est_err:.2f}")

# relative estimation error
rel_est_err = (df["Estimation"] / df["Spent time"] - 1).abs().mean()
print(f"Relative task estimation error: {rel_est_err:.2f}")

# time of testing and review
print("*" * 50, "Testing and code review", "*" * 50)
print_time_for_tasks("Unit test", "Unit Testing")
print_time_for_tasks("Integration test", "Integration Testing")
print_time_for_tasks("E2E test", "End to End Testing")
print_time_for_tasks("Code review", "Code Review")
