import pandas as pd

# extracts the total estimated and actual time spent for tasks where the title contains the given keyword
def print_hours_for_tasks(task_keyword, title):
	tasks = df[df["Summary"].str.contains(task_keyword, case=False, na=False)]
	estimate = tasks["Estimation"]
	actual = tasks["Spent time"]
	print(f"{title} stats: total estimate = {estimate.sum():.2f}, total actual = {actual.sum():.2f}")


file_name = "Issues.csv"
sprint = "Sprint 1"

# load data, considering only some completed tasks for the selected sprint
df = pd.read_csv(file_name, encoding="utf-8-sig")
df = df[(df["Type"] == "Task") & (df["Sprints"] == sprint) & (df["State"] == "Done")]


# convert time fields in hours
minute_cols = ["Hours per person", "Spent time", "Estimation"] # Hours per person is in minutes...
for c in minute_cols:
    df[c] = pd.to_numeric(df[c], errors="coerce").fillna(0) # strings/blank -> NaN -> 0
    df[c] = df[c] / 60 

# add and remove some columns
df["Number of Assignees"] = df["Assignee"].str.count(",") + 1
df["Normalized Estimation"] = df["Estimation"] / df["Number of Assignees"]
df["Normalized Spent time"] = df["Spent time"] / df["Number of Assignees"]
df = df.drop(columns=[
	"Project", "Tags", "Votes", "Priority", "Updated", "Created", "Resolved",
	"Description", "Story points", "Original estimation", "State",
	"Ideal days", "Type", "Sprints", "Assignee", "Reporter", "Hours per person"
	])


# display options
pd.set_option("display.max_columns", None)
pd.set_option("display.width", 200)
print("*" * 50, f"Completed tasks for sprint '{sprint}'", "*" * 50)
print(df)

# stats calculation
print("*" * 50, "Tasks statistics (hours)", "*" * 50)
# estimated hours per task (per person)
col = df["Normalized Estimation"]
print(f"Estimated hours per task per person: mean = {col.mean():.2f}, std = {col.std():.2f}")

# actual hours per task (per person)
col = df["Normalized Spent time"]
print(f"Actual hours per task per person: mean = {col.mean():.2f}, std = {col.std():.2f}")

# total estimation error
est_err = (df["Spent time"].sum() / df["Estimation"].sum()) - 1
print(f"Total task estimation error: {est_err:.2f}")

# relative estimation error
rel_est_err = (df["Spent time"] / df["Estimation"] - 1).abs().mean()
print(f"Relative task estimation error: {rel_est_err:.2f}")

# hours of testing and review
print("*" * 50, "Testing and code review (hours)", "*" * 50)
print_hours_for_tasks("Unit test", "Unit Testing")
print_hours_for_tasks("Integration test", "Integration Testing")
print_hours_for_tasks("E2E test", "End to End Testing")
print_hours_for_tasks("Code review", "Code Review")
