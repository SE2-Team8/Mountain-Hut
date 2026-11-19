RETROSPECTIVE 02 (Team 08)
=====================================

- [process measures](#process-measures)
- [quality measures](#quality-measures)
- [general assessment](#assessment)

## PROCESS MEASURES 

### Macro statistics

- Number of stories committed vs done : 3 vs 3
- Total points committed vs done : 9 vs 9
- Nr of hours planned vs spent (as a team) : 81h 30m vs 82h 30m

### Definition of Done for a User Story:
 
- Unit Tests passing
- Integration Tests passing
- Code review completed
- Code present on VCS
- End-to-End Tests performed
- Endpoints documented (server)

### Detailed statistics

| Story  | # Tasks | Points | Hours est. | Hours actual |
|--------|:-------:|:------:|:----------:|:------------:|
| _#0_   |    33   |    -   |  41h 10m   |    39h 15m   |
| MH-04  |    12   |    3   |  15h       |    14h 25m   |
| MH-05  |    10   |    1   |   9h 10m   |    11h 50m   |
| MH-06  |    12   |    5   |  16h 10m   |    17h       |
   

#### Note: all the values from this point on are computed only considering completed tasks

- Estimated Hours per task <span style="color:green">per person</span>:
	- average = 1h 6m
	- standard deviation = 34m 
- Actual Hours per task <span style="color:green">per person</span>:
	- average = 1h 7m
	- standard deviation = 38m 
- Total task estimation error ratio `sum(total hours estimation) / sum(total hours spent) -1`: 

	-0.01
- Relative task estimation error ratio `sum(abs(hours estimation for task / hours spent for task -1)) / (number of tasks)`:

	0.24

  
## QUALITY MEASURES 

- Unit Testing:
  - Total hours estimated: 4h 30m
  - Total hours spent: 5h 4m
  - Nr of automated unit test cases: 320 
  - Coverage (server):
	- Statements: 96%
	- Branch: 87%
	- Functions: 98%
	- Lines: 96%
- Integration testing:
  - Total hours estimated: 5h
  - Total hours spent: 6h
- E2E testing:
  - Total hours estimated: 2h
  - Total hours spent: 2h
- Code review: 
  - Total hours estimated: 5h 40m
  - Total hours spent: 4h 19m


## ASSESSMENT

- What caused your errors in estimation (if any)?

	* For some team members who hadn't already worked on the frontend, creating new pages or expanding existing ones was harder (and more time-consuming) than anticipated
	* For some functionalities, the implementation itself was close to the estimation in terms of required time, but fixing arising problems and bugs was not accounted for

- What lessons did you learn (both positive and negative) in this sprint?

	* All team members should be involved in the definition meeting when a new (big) feature is to be defined
	* The lack of internal deadlines for user stories completion can lead to more pressure at the end of the sprint
	* The task assignments and work distribution should take into account all team members available work times (i.e. lectures schedule...)
	* During planning, it is better not to create all the tasks before assigning and estimating them, to avoid unnecessary time wasted on tasks that cannot be placed inside the available time budget

- Which improvement goals set in the previous retrospective were you able to achieve? 
  
	* "We would like to define a shared "policy" on how to handle bug-fixes in terms of task tracking on YouTrack"
	* "We would like to define a finer granularity for technical tasks (i.e. have a clearer distinction between coding and design)"
	* "We would like to achieve a better estimate of a task duration" (could be improved further)

- Which ones you were not able to achieve? Why?

	None

- Improvement goals for the next sprint and how to achieve them (technical tasks, team coordination, etc.)

	* We would like to better handle the workload throughout the two weeks of sprint by setting internal deadlines for user stories completion
	* We would like to improve coordination by making all team members partecipate to the feature definition meetings, especially for "big" features
	* We would like to have a more focused planning phase, specifically we want to keep the order create/assign/estimate for each task, but we want to take into account the available work times of the team and also avoid creating many tasks that will not be possible to complete within the time budget

- One thing you are proud of as a Team!!

	We are proud of being able to react well to some unexpected problems during the last days of work; we assessed the situation quickly, agreed on what to do and completed the fixes without hurting the schedule too much.