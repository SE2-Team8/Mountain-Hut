RETROSPECTIVE 01 (Team 08)
=====================================

- [process measures](#process-measures)
- [quality measures](#quality-measures)
- [general assessment](#assessment)

## PROCESS MEASURES 

### Macro statistics

- Number of stories committed vs done : 4 vs 3
- Total points committed vs done : 18 vs 15
- Nr of hours planned vs spent (as a team) : 85h vs 77h

### Definition of Done for a User Story:
 
- Unit Tests passing
- Integration Tests passing
- Code review completed
- Code present on VCS
- End-to-End Tests performed
- Endpoints documented (server)

### Detailed statistics

| Story  | # Tasks | Points | Hours est. | Hours actual |
|--------|---------|--------|------------|--------------|
| _#0_   |    11   |    -   |  34h 50m   |    33h 30m   |
| MH-01  |     9   |    8   |  15h 10m   |    22h 30m   |
| MH-02  |     8   |    5   |  12h 30m   |    15h 50m   |
| MH-03  |     5   |    2   |   7h       |     5h 20m   |
| MH-04  |     7   |    3   |  15h 30m   |     0h       |

#### Note: all the values from this point on are computed only considering completed tasks

- Estimated Hours per task <span style="color:green">per person</span>:
	- average = 1.32
	- standard deviation = 0.60 
- Actual Hours per task <span style="color:green">per person</span>:
	- average = 1.55
	- standard deviation = 1.08 
- Total task estimation error ratio `sum(total hours estimation) / sum(total hours spent) -1`: 

	0.12
- Relative task estimation error ratio `sum(abs(hours estimation for task / hours spent for task -1)) / (number of tasks)`:

	0.35

  
## QUALITY MEASURES

- Unit Testing:
  - Total hours estimated: 5.0
  - Total hours spent: 6.67
  - Nr of automated unit test cases: 162 
  - Coverage (if available) (server):
	- Statements: 95%
	- Branch: 87%
	- Functions: 98%
	- Lines: 95%
- Integration testing:
  - Total hours estimated: 5
  - Total hours spent: 6.17
- E2E testing:
  - Total hours estimated: 3.17
  - Total hours spent: 2.17
- Code review: 
  - Total hours estimated: 2.50
  - Total hours spent: 3.08


## ASSESSMENT

- What caused your errors in estimation (if any)?

	* We completed the pilot project with less time than needed and we were overconfident with the required we would need to start this project
	* Tasks were not defined with enough granularity, so additional work to do was often discovered half-way through and so the overall amount of work was underestimated

- What lessons did you learn (both positive and negative) in this sprint?
	
	* When estimating task duration based only on the work to do and not considering the assignee and their knowledge of the technology involved, some mistakes are made in estimation
	* If task distribution among team members does not give enough weight to task interdependencies, there can be times where some developers have no task that could be worked on because of dependencies from other non-yet-completed tasks, while at the same time some other members are assigned to multiple tasks needed for the project to continue, essensially reducing the amount of work that the team can parallelize
	* Lack of coordination or guidelines about code structure can lead to slowdown in the implementation phase and especially during the testing activities
	* Documentation can be hard to parallelize and allocate in calendar when treated as an horizontal task 
	* Issues on github may take longer than expected to get answered so it is better to analyze the story very early in the sprint calendar days and try to figure out questions about the requirements as soon as possible

- Which improvement goals set in the previous retrospective were you able to achieve?

	* To track separately unit, integration and E2E testing
  * To not try to assign perfectly the tasks right at the beginning
  * To improve test quality
  * To prepare better for the demo
  
- Which ones you were not able to achieve? Why?

	* To reduce task estimation error. We underestimated the amout of work for the first two user stories

- Improvement goals for the next sprint and how to achieve them (technical tasks, team coordination, etc.)

	* We would like to achieve a better estimate of a task duration and we aim to achieve that by assigning the task first and then doing the estimate considering the assignee
	* We would like to define a shared "policy" on how to handle bug-fixes in terms of task tracking on YouTrack
	* We would like to define a finer granularity for technical tasks (i.e. have a clearer distinction between coding and design) so that we can better estimate the work to do, assign each item to potentially different team members and parallelize the work more efficiently

- One thing you are proud of as a Team!!

	We believe that, due to good internal communication, we handled well the pressure that we faced once we realized that the time needed for various tasks had been underestimated: we kept the morale up and at the end we managed to complete the third user story in time.