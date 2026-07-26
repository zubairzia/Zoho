// ╔══════════════════════════════════════════════════════════════════╗
	// ║           PAYROLL CALCULATION FUNCTION — NewLatestPayroll        ║
	// ║                                                                  ║
	// ║  Purpose : Calculate monthly payroll for a single employee       ║
	// ║  Trigger : Button click on Employee List Report                  ║
	// ║  Author  : HR & IT Department                                    ║
	// ╚══════════════════════════════════════════════════════════════════╝
	// PARAMETERS:
	//   - PayrollMonth : string — Month name e.g. "July"
	//   - empID        : string — Employee ID from Employee_Information form
	// ══════════════════════════════════════════════
	// PAYROLL PERIOD:
	//   - Start : 26th of previous month
	//   - End   : 25th of current month
	//   - Example: For July → 26-Jun to 25-Jul
	// ══════════════════════════════════════════════
	// ══════════════════════════════════════════════
	// DATA SYNC (runs before this function via button):
	//   1. Attendance synced from Zoho People API
	//      for full payroll period — catches backdated changes
	//   2. Hourly Permissions synced from Zoho People API
	//      for full payroll period — catches backdated submissions
	//   3. Regularization Requests synced from Zoho People API
	//      for full payroll period — catches multi-day requests
	// ══════════════════════════════════════════════
	// ══════════════════════════════════════════════
	// SALARY FORMULA:
	//   Gross Salary     = Basic Salary + All Allowances
	//   Total Deductions = Short Hours Deduction
	//                    + Absent Deduction
	//                    + LWP Deduction
	//   Net Salary       = Gross Salary - Total Deductions
	// ══════════════════════════════════════════════
	// ══════════════════════════════════════════════
	// DEDUCTION RULES:
	//   1. Short Hours Deduction:
	//      - Calculated per day for Present and WFH days only
	//      - If employee worked >= 8 hours → NO deduction
	//        (even if they came in late)
	//      - If employee worked < 8 hours → deduct missing minutes
	//        Missing Minutes × Per Minute Salary = Deduction
	//      - Today's date is always SKIPPED (employee not checked out yet)
	//
	//   2. Hourly Permission Override:
	//      - If employee has an APPROVED hourly permission for a short day
	//      - Permission covers ALL missing time → NO deduction
	//      - Permission covers PARTIAL missing time → deduct remainder only
	//      - Pending or Rejected permissions → deduct as normal
	//
	//   3. Regularization Override:
	//      - Applied AFTER the main attendance loop
	//      - Uses indApprovalStatus (per-day approval) not overall status
	//        because one request can cover multiple days with different
	//        approval states per day
	//      - If approved → replaces old hours with newTotalHours
	//      - Recalculates short hours using new hours
	//      - Also checks hourly permissions on the new hours
	//      - Updates actualLateMinutes using newCheckInTime
	//
	//   4. Absent Days Deduction:
	//      - Each absent day × Per Day Salary = Deduction
	//
	//   5. Leave Without Pay (LWP) Deduction:
	//      - Each LWP day × Per Day Salary = Deduction
	// ══════════════════════════════════════════════
	// ══════════════════════════════════════════════
	// NOT DEDUCTED:
	//   - Paid Leaves (Annual, Sick, Marriage, Maternity,
	//     Paternity, Deceased, Exam, Sabbatical, Overtime Leave)
	//   - Public Holidays (any status containing "Holiday")
	//   - Weekends (Friday and Saturday)
	//   - Overtime hours (tracked but not added or deducted)
	//   - Today's attendance (employee not checked out yet)
	// ══════════════════════════════════════════════
	// ══════════════════════════════════════════════
	// WORKING DAYS:
	//   - Sunday to Thursday only
	//   - Friday and Saturday excluded as weekends
	//   - Counted between 26th and 25th of the period
	//   - Used to calculate per day salary rate
	// ══════════════════════════════════════════════
	// ══════════════════════════════════════════════
	// SALARY RATES:
	//   Per Day Salary    = Basic Salary / Total Working Days
	//   Per Hour Salary   = Per Day Salary / 8
	//   Per Minute Salary = Per Hour Salary / 60
	// ══════════════════════════════════════════════
	// ══════════════════════════════════════════════
	// ATTENDANCE TRACKING:
	//   totalPresentDays   → Present + Work From Home days
	//   totalAbsentDays    → Absent days (deducted)
	//   totalWeekends      → Friday + Saturday days
	//   Public_Holiday     → Any status containing "Holiday"
	//   totalPaidLeaves    → All paid leave types combined
	//   totalUnpaid        → Absent + LWP days combined
	//   LeavesTaken        → All leave days (paid + unpaid)
	//   totalHoursWorked   → Actual hours including overtime
	//   totalovertime      → Hours beyond standard shift
	//   actualLateMinutes  → Late check-in minutes (display only)
	//   totalLateMinutes   → Short hours in minutes (used for deduction)
	//   totalPermissionMinutes → Approved permission minutes used
	// ══════════════════════════════════════════════
	// ══════════════════════════════════════════════
	// DUPLICATE PREVENTION:
	//   - Checks Salary_Register for same employee + month + year
	//   - If Pending record exists → UPDATE
	//   - If no record exists → INSERT with Payroll_Status = "Pending"
	//   - If record is Finalized or Approved → SKIP completely
	//     (finalized payroll is never overwritten)
	// ══════════════════════════════════════════════
	// ══════════════════════════════════════════════
	// WFH HANDLING:
	//   "Work From Home" (capital) = Zoho People built-in WFH feature
	//     → Counted as present day
	//     → Late/short hours calculated normally
	//   "Work from home" (lowercase) = Leave type in system
	//     → Counted as paid leave
	//     → No short hours deduction
	// ══════════════════════════════════════════════
	// ══════════════════════════════════════════════
	// COMBINED STATUS HANDLING:
	//   e.g. "Annual Leave, Present" — employee applied for leave
	//   but also checked in and worked
	//   → Treated as Present (employee physically came in)
	//   → Hours calculated normally
	// ══════════════════════════════════════════════
	monthMap = Map();
	monthMap.put("January",1);
	monthMap.put("February",2);
	monthMap.put("March",3);
	monthMap.put("April",4);
	monthMap.put("May",5);
	monthMap.put("June",6);
	monthMap.put("june",6);
	monthMap.put("July",7);
	monthMap.put("August",8);
	monthMap.put("September",9);
	monthMap.put("October",10);
	monthMap.put("November",11);
	monthMap.put("December",12);
	monthNum = monthMap.get(PayrollMonth);
	year = zoho.currentdate.getYear();
	currentYear = year.toString();
	// Build period dates
	// Example: PayrollMonth = "July" → Start: 26-Jun, End: 25-Jul
	selectedDate = (year + "-" + monthNum + "-01").toDate("yyyy-MM-dd");
	prevMonthDate = selectedDate.addMonth(-1);
	Starting_date = "26-" + prevMonthDate.getMonth() + "-" + prevMonthDate.getYear();
	Ending_date = "25-" + monthNum + "-" + year;
	Start_date = ("26-" + prevMonthDate.getMonth() + "-" + prevMonthDate.getYear()).toDate("dd-MM-yyyy");
	End_date = ("25-" + monthNum + "-" + year).toDate("dd-MM-yyyy");
	// ══════════════════════════════════════════════
	// SECTION 2: FETCH EMPLOYEE DATA
	// Look up employee by Employee_ID
	// Guard against employee not found
	// ══════════════════════════════════════════════
	employee_data = Employee_Information[Employee_ID == empID];
	if(employee_data.count() == 0)
	{
		info "ERROR: Employee not found for ID: " + empID;
		return;
	}
	// ══════════════════════════════════════════════
	// SECTION 3: FETCH ATTENDANCE & EXISTING PAYROLL
	// Pull all attendance records for this employee
	// within the payroll period
	// Also check if payroll already exists this month
	// ══════════════════════════════════════════════
	X_Attend = Attendance[Employee_Information == employee_data.ID && Date_field >= Start_date && Date_field <= End_date];
	existing_payroll = Salary_Register[Employee_Name == employee_data.ID && Select_Month == PayrollMonth && Select_Year == currentYear];
	// ══════════════════════════════════════════════
	// SECTION 4: INITIALIZE ALL COUNTERS TO ZERO
	// All variables start at zero before the
	// attendance loop begins
	// ══════════════════════════════════════════════
	totalPresentDays = 0;
	// Days marked Present or WFH
	totalAbsentDays = 0;
	// Days marked Absent
	totalUnpaid = 0;
	// Absent + Leave Without Pay days
	totalPaidLeaves = 0;
	// All paid leave days combined
	LeavesTaken = 0;
	// Total leave days (paid + unpaid)
	AnnualLeave = 0;
	Deceased_Leave = 0;
	Exam_leave = 0;
	Leave_Without_Pay = 0;
	Marriage_Leave = 0;
	Maternity_Leave = 0;
	overtime_leave = 0;
	Paternity_Leave = 0;
	Sabbatical_Leave = 0;
	Sick_Leave = 0;
	Work_from_home = 0;
	totalWeekends = 0;
	totalHoursWorked = 0.0;
	// Actual total hours worked including overtime
	totalLateMinutes = 0.0;
	// Total minutes short across all present days
	actualLateMinutes = 0.0;
	// Actual late check-in minutes (for display only)
	totalovertime = 0.0;
	// Total overtime hours
	Public_Holiday = 0;
	totalPermissionMinutes = 0.0;
	totalRegularizations = 0;
	// Total regularization records in period
	approvedRegularizations = 0;
	// Approved per indApprovalStatus
	pendingRegularizations = 0;
	// Pending per indApprovalStatus
	rejectedRegularizations = 0;
	// Rejected per indApprovalStatus
	// Total approved hourly permission minutes
	// Count of public holiday days
	// ══════════════════════════════════════════════
	// SECTION 5: COMPANY POLICY CONSTANTS
	// Standard working hours: 08:00 to 16:00
	// These values drive all time calculations
	// ══════════════════════════════════════════════
	standard_checkin_mins = 8 * 60;
	// 08:00 = 480 minutes
	standard_checkout_mins = 16 * 60;
	// 16:00 = 960 minutes
	working_hours_per_day = 8;
	// 8 hour workday
	// ══════════════════════════════════════════════
	// SECTION 6: ATTENDANCE LOOP
	// Process each attendance record one by one
	// Categorize status and accumulate counters
	// ══════════════════════════════════════════════
	for each  Y_Attend in X_Attend
	{
		// ── Present Days ──
		// Both "Present" and "Work From Home" count as present
		// WFH employees are treated exactly like office present days
		if(Y_Attend.Status == "Present")
		{
			totalPresentDays = totalPresentDays + 1;
		}
		if(Y_Attend.Status == "Work From Home")
		{
			totalPresentDays = totalPresentDays + 1;
		}
		// ── Absent Days ──
		// Absent days are deducted from salary
		// Also counted in totalUnpaid
		if(Y_Attend.Status == "Absent")
		{
			totalAbsentDays = totalAbsentDays + 1;
			totalUnpaid = totalUnpaid + 1;
		}
		// ── Weekends ──
		// Friday and Saturday — no deduction, just tracked
		if(Y_Attend.Status == "Weekend")
		{
			totalWeekends = totalWeekends + 1;
		}
		// ── Public Holidays ──
		// Any status containing "Holiday" (e.g. "Eid Al Adha(Holiday)")
		// is counted as a public holiday — NO deduction
		if(Y_Attend.Status.contains("Holiday") == true)
		{
			Public_Holiday = Public_Holiday + 1;
		}
		// ── Leave Types ──
		// Everything that is not Present, Absent, Weekend, WFH, or Holiday
		// is treated as a leave — categorized below
		if(Y_Attend.Status != "Present" && Y_Attend.Status != "Absent" && Y_Attend.Status != "Weekend" && Y_Attend.Status != "Work From Home" && Y_Attend.Status.contains("Holiday") == false)
		{
			LeavesTaken = LeavesTaken + 1;
			// Paid Leaves — NO salary deduction
			if(Y_Attend.Status == "Annual Leave")
			{
				AnnualLeave = AnnualLeave + 1;
				totalPaidLeaves = totalPaidLeaves + 1;
			}
			if(Y_Attend.Status == "Deceased Leave")
			{
				Deceased_Leave = Deceased_Leave + 1;
				totalPaidLeaves = totalPaidLeaves + 1;
			}
			if(Y_Attend.Status == "Exam leave")
			{
				Exam_leave = Exam_leave + 1;
				totalPaidLeaves = totalPaidLeaves + 1;
			}
			if(Y_Attend.Status == "Marriage Leave")
			{
				Marriage_Leave = Marriage_Leave + 1;
				totalPaidLeaves = totalPaidLeaves + 1;
			}
			if(Y_Attend.Status == "Maternity Leave")
			{
				Maternity_Leave = Maternity_Leave + 1;
				totalPaidLeaves = totalPaidLeaves + 1;
			}
			if(Y_Attend.Status == "overtime leave")
			{
				overtime_leave = overtime_leave + 1;
				totalPaidLeaves = totalPaidLeaves + 1;
			}
			if(Y_Attend.Status == "Paternity Leave")
			{
				Paternity_Leave = Paternity_Leave + 1;
				totalPaidLeaves = totalPaidLeaves + 1;
			}
			if(Y_Attend.Status == "Sabbatical Leave")
			{
				Sabbatical_Leave = Sabbatical_Leave + 1;
				totalPaidLeaves = totalPaidLeaves + 1;
			}
			if(Y_Attend.Status == "Sick Leave")
			{
				Sick_Leave = Sick_Leave + 1;
				totalPaidLeaves = totalPaidLeaves + 1;
			}
			if(Y_Attend.Status == "Work from home")
			{
				// lowercase "work from home" = leave type (not WFH feature)
				Work_from_home = Work_from_home + 1;
				totalPaidLeaves = totalPaidLeaves + 1;
			}
			// Unpaid Leave — DEDUCTED from salary
			if(Y_Attend.Status == "Leave Without Pay")
			{
				Leave_Without_Pay = Leave_Without_Pay + 1;
				totalUnpaid = totalUnpaid + 1;
			}
		}
		// ── Total Hours Worked ──
		// Using TotalHours field which shows actual hours worked
		// including overtime (e.g. 8:20 stays as 8:20)
		// Work_Hours field is capped at 8 so we don't use it
		// Skip today — employee hasn't checked out yet
		attendDateStr = Y_Attend.Date_field.toString("yyyy-MM-dd");
		todayStr = zoho.currentdate.toString("yyyy-MM-dd");
		if(attendDateStr != todayStr)
		{
			workHoursStr = Y_Attend.TotalHours;
			if(workHoursStr.toString() != null && workHoursStr.toString() != "" && workHoursStr.toString() != "-")
			{
				whParts = workHoursStr.toList(":");
				hours = whParts.get(0).toDecimal();
				minutes = whParts.get(1).toDecimal();
				totalHoursWorked = totalHoursWorked + hours + minutes / 60;
			}
			// ── Overtime Hours ──
			// Tracked for records but NOT added to salary
			// and NOT used to offset short hours on other days
			overtimeStr = Y_Attend.OverTime;
			if(overtimeStr.toString() != null && overtimeStr.toString() != "" && overtimeStr.toString() != "-")
			{
				otParts = overtimeStr.toList(":");
				othours = otParts.get(0).toDecimal();
				otminutes = otParts.get(1).toDecimal();
				totalovertime = totalovertime + othours + otminutes / 60;
			}
		}
		// ── Short Hours & Late Minutes Calculation ──
		// Only calculated for Present and WFH days
		// Two separate tracking:
		//   1. actualLateMinutes → how late was the check-in (display only)
		//   2. totalLateMinutes  → how many minutes short of 8 hours (used for deduction)
		if(Y_Attend.Status == "Present" || Y_Attend.Status == "Work From Home")
		{
			// ── SKIP TODAY — employee hasn't checked out yet ──
			// ── Short Hours & Late Minutes Calculation ──
			// Only calculated for Present and WFH days
			// Two separate tracking:
			//   1. actualLateMinutes → how late was the check-in (display only)
			//   2. totalLateMinutes  → how many minutes short of 8 hours (used for deduction)
			attendDateStr = Y_Attend.Date_field.toString("yyyy-MM-dd");
			todayStr = zoho.currentdate.toString("yyyy-MM-dd");
			if(attendDateStr == todayStr)
			{
				info "Skipped today | Date: " + attendDateStr + " | Not checked out yet";
				continue;
			}
			// ── Track actual late check-in minutes (FOR DISPLAY ONLY) ──
			// This shows HR how late the employee checked in
			// but does NOT affect deductions
			firstInStr = Y_Attend.FirstIn;
			if(firstInStr.toString() != null && firstInStr.toString() != "" && firstInStr.toString() != "-")
			{
				firstInTime = firstInStr.toString("HH:mm");
				firstIn_parts = firstInTime.toList(":");
				firstIn_hours = firstIn_parts.get(0).toDecimal();
				firstIn_minutes = firstIn_parts.get(1).toDecimal();
				firstIn_total = firstIn_hours * 60 + firstIn_minutes;
				if(firstIn_total > standard_checkin_mins)
				{
					late_today = firstIn_total - standard_checkin_mins;
					actualLateMinutes = actualLateMinutes + late_today;
					info "Late check-in | Date: " + Y_Attend.Date_field + " | Late by: " + late_today + " mins (display only)";
				}
			}
			// ── Track short hours per day (USED FOR DEDUCTION) ──
			// Rule: If employee worked >= 8 hours → NO deduction
			//       If employee worked < 8 hours  → deduct the difference
			// Example: Worked 7:45 → missing 15 mins → deduct 15 × per_minute_salary
			// Example: Came at 8:13 but worked 8:14 → NO deduction
			dayHoursStr = Y_Attend.TotalHours;
			dayHoursWorked = 0.0;
			if(dayHoursStr.toString() != null && dayHoursStr.toString() != "" && dayHoursStr.toString() != "-")
			{
				dayParts = dayHoursStr.toList(":");
				dayH = dayParts.get(0).toDecimal();
				dayM = dayParts.get(1).toDecimal();
				dayHoursWorked = dayH + dayM / 60;
			}
			if(dayHoursWorked >= working_hours_per_day)
			{
				info "Full hours completed | Date: " + Y_Attend.Date_field + " | Hours: " + dayHoursWorked;
			}
			else
			{
				// ── Check if employee has approved hourly permission for this date ──
				attendDateForPerm = Y_Attend.Date_field.toString("yyyy-MM-dd");
				approved_perm = Hourly_Permissions[Employee_ID == empID && Permission_date == attendDateForPerm && Approval_Status == "Approved"];
				missing_mins_today = (working_hours_per_day - dayHoursWorked) * 60;
				if(approved_perm.count() > 0)
				{
					// ── Permission found — calculate coverage ──
					perm_time_str = approved_perm.Total_Time;
					perm_mins = 0.0;
					if(perm_time_str != null)
					{
						perm_parts = perm_time_str.toList(":");
						perm_hours = perm_parts.get(0).toDecimal();
						perm_min = perm_parts.get(1).toDecimal();
						perm_mins = perm_hours * 60 + perm_min;
					}
					// Track total permission minutes used
					totalPermissionMinutes = totalPermissionMinutes + perm_mins;
					if(perm_mins >= missing_mins_today)
					{
						// Permission covers ALL missing time → NO deduction
						info "Permission covers shortage | Date: " + Y_Attend.Date_field + " | Missing: " + missing_mins_today + " mins | Permission: " + perm_mins + " mins → NO deduction";
					}
					else
					{
						// Permission covers PARTIAL missing time → deduct remaining only
						remaining_mins = missing_mins_today - perm_mins;
						totalLateMinutes = totalLateMinutes + remaining_mins;
						info "Partial permission | Date: " + Y_Attend.Date_field + " | Missing: " + missing_mins_today + " mins | Permission: " + perm_mins + " mins | Deducting: " + remaining_mins + " mins";
					}
				}
				else
				{
					// No approved permission → deduct full missing time
					totalLateMinutes = totalLateMinutes + missing_mins_today;
					info "Short hours | Date: " + Y_Attend.Date_field + " | Missing: " + missing_mins_today + " mins | No permission found";
				}
				////
			}
		}
	}
	// ══════════════════════════════════════════════
	// SECTION 6B: COUNT REGULARIZATION REQUESTS
	// Summary counts for HR visibility in payroll record
	// Uses indApprovalStatus (per-day approval)
	// ══════════════════════════════════════════════
	reg_records = Regularization_Requests[employeeId == empID && Date_field >= Start_date && Date_field <= End_date];
	for each  reg in reg_records
	{
		totalRegularizations = totalRegularizations + 1;
		if(reg.indApprovalStatus == "Approved")
		{
			approvedRegularizations = approvedRegularizations + 1;
		}
		else if(reg.indApprovalStatus == "Pending")
		{
			pendingRegularizations = pendingRegularizations + 1;
		}
		else if(reg.indApprovalStatus == "Rejected")
		{
			rejectedRegularizations = rejectedRegularizations + 1;
		}
	}
	info "Regularizations | Total: " + totalRegularizations + " | Approved: " + approvedRegularizations + " | Pending: " + pendingRegularizations + " | Rejected: " + rejectedRegularizations;
	// ══════════════════════════════════════════════
	// SECTION 7: COUNT TOTAL WORKING DAYS
	// Loop through each day in the period
	// Count only Sunday to Thursday
	// Friday and Saturday are excluded as weekends
	// ══════════════════════════════════════════════
	totalWorkingDays = 0;
	dayList = {0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31};
	for each  i in dayList
	{
		currentDate = Start_date.addDay(i);
		if(currentDate <= End_date)
		{
			dayName = currentDate.toString("EEEE");
			if(dayName != "Friday" && dayName != "Saturday")
			{
				totalWorkingDays = totalWorkingDays + 1;
			}
		}
	}
	// ══════════════════════════════════════════════
	// SECTION 8: SALARY RATE CALCULATIONS
	// Per Day  = Basic Salary / Total Working Days
	// Per Hour = Per Day / 8
	// Per Min  = Per Hour / 60
	// ══════════════════════════════════════════════
	basic_salary = employee_data.Basic_Salary;
	if(totalWorkingDays > 0)
	{
		per_day_salary = (basic_salary / totalWorkingDays).toDecimal().round(2);
	}
	else
	{
		per_day_salary = 0.0;
	}
	per_hour_salary = (per_day_salary / working_hours_per_day).toDecimal().round(2);
	per_minute_salary = (per_hour_salary / 60).toDecimal().round(2);
	// ══════════════════════════════════════════════
	// SECTION 9: DEDUCTION CALCULATIONS
	//
	// Deduction 1 — Short Hours:
	//   totalLateMinutes accumulated per day in loop above
	//   Any day with < 8 hours worked contributes missing minutes
	//   Deduction = Total Short Minutes × Per Minute Salary
	//
	// Deduction 2 — Absent Days:
	//   Each absent day = full day salary deducted
	//   Deduction = Absent Days × Per Day Salary
	//
	// Deduction 3 — Leave Without Pay:
	//   Same as absent — full day deducted per LWP day
	//   Deduction = LWP Days × Per Day Salary
	// ══════════════════════════════════════════════
	late_deduction = 0.0;
	if(totalLateMinutes > 0)
	{
		late_deduction = (totalLateMinutes * per_minute_salary).toDecimal().round(2);
	}
	absent_deduction = (totalAbsentDays * per_day_salary).toDecimal().round(2);
	lwp_deduction = (Leave_Without_Pay * per_day_salary).toDecimal().round(2);
	// ══════════════════════════════════════════════
	// SECTION 10: ALLOWANCES & GROSS SALARY
	// Sum all allowances from employee record
	// Gross = Basic + All Allowances (before deductions)
	// ══════════════════════════════════════════════
	Total_Allowances = (ifnull(employee_data.Mobile_Allowance,0) + ifnull(employee_data.Education_Allowance,0) + ifnull(employee_data.Housing_Allowance,0) + ifnull(employee_data.Transportation,0) + ifnull(employee_data.Fuel_Allowance,0) + ifnull(employee_data.COL_Allowance,0) + ifnull(employee_data.Food_Allowance,0) + ifnull(employee_data.Ticket_Allowance,0) + ifnull(employee_data.Other_Allowance,0) + ifnull(employee_data.Fixed_Bonus,0)).toDecimal().round(2);
	gross_salary = (basic_salary + Total_Allowances).toDecimal().round(2);
	// ══════════════════════════════════════════════
	// SECTION 11: TOTAL DEDUCTIONS & NET SALARY
	// Total Deductions = Short Hours + Absent + LWP
	// Net Salary = Gross Salary - Total Deductions
	// Overtime tracked but NOT added to net salary
	// ══════════════════════════════════════════════
	total_deductions = (absent_deduction + lwp_deduction + late_deduction).toDecimal().round(2);
	overtime_amount = (totalovertime * per_hour_salary).toDecimal().round(2);
	net_salary = (gross_salary - total_deductions).toDecimal().round(2);
	// ══════════════════════════════════════════════
	// SECTION 12: DEBUG SUMMARY
	// Printed to Zoho Creator logs for verification
	// ══════════════════════════════════════════════
	info "══════════════════════════════════════";
	info "PAYROLL SUMMARY: " + empID;
	info "Period          : " + Starting_date + " to " + Ending_date;
	info "──────────────────────────────────────";
	info "Total Working Days (period) : " + totalWorkingDays + " (excludes weekends)";
	info "Total Days Worked (present) : " + totalPresentDays + " (actual present days)";
	info "Absent Days        : " + totalAbsentDays;
	info "Weekends           : " + totalWeekends;
	info "Public Holidays    : " + Public_Holiday;
	info "Paid Leaves        : " + totalPaidLeaves;
	info "Unpaid (LWP)       : " + Leave_Without_Pay;
	info "──────────────────────────────────────";
	info "Total Hours Worked : " + totalHoursWorked;
	info "Overtime Hours     : " + totalovertime;
	info "Actual Late Mins   : " + actualLateMinutes + " (display only)";
	info "Short Hours Mins   : " + totalLateMinutes + " (used for deduction)";
	info "Permission Minutes    : " + totalPermissionMinutes + " (approved hourly permissions)";
	info "Permission Hours      : " + (totalPermissionMinutes / 60).toDecimal().round(2);
	info "──────────────────────────────────────";
	info "Basic Salary       : " + basic_salary;
	info "Per Day Salary     : " + per_day_salary;
	info "Per Hour Salary    : " + per_hour_salary;
	info "Per Minute Salary  : " + per_minute_salary;
	info "Total Allowances   : " + Total_Allowances;
	info "Gross Salary       : " + gross_salary;
	info "──────────────────────────────────────";
	info "Short Hours Ded.   : " + late_deduction;
	info "Absent Deduction   : " + absent_deduction;
	info "LWP Deduction      : " + lwp_deduction;
	info "Total Deductions   : " + total_deductions;
	info "──────────────────────────────────────";
	info "NET SALARY         : " + net_salary;
	info "══════════════════════════════════════";
	info "──────────────────────────────────────";
	info "Total Regularizations   : " + totalRegularizations;
	info "Approved Regularizations: " + approvedRegularizations;
	info "Pending Regularizations : " + pendingRegularizations;
	info "Rejected Regularizations: " + rejectedRegularizations;
	// ══════════════════════════════════════════════
	// SECTION 13: SAVE TO SALARY REGISTER
	// If record exists for this employee+month+year:
	//   → UPDATE (unless Finalized/Approved)
	// If no record exists:
	//   → INSERT new record with Pending status
	// ══════════════════════════════════════════════
	if(existing_payroll.count() > 0)
	{
		// Guard: Never overwrite a finalized or approved payroll
		if(existing_payroll.Payroll_Status == "Finalized" || existing_payroll.Payroll_Status == "Approved")
		{
			info "SKIPPED: Payroll already " + existing_payroll.Payroll_Status + " for: " + empID;
			return;
		}
		info "Updating existing payroll for: " + empID;
		existing_payroll.Last_Calculation_Time=zoho.currenttime;
		existing_payroll.Total_Days_Worked=totalPresentDays;
		existing_payroll.Total_Working_Days_This_Month=totalWorkingDays;
		existing_payroll.Total_Absent_Days=totalAbsentDays;
		existing_payroll.Total_Weekends=totalWeekends;
		existing_payroll.UnPaid_Leaves_Taken=totalUnpaid;
		existing_payroll.Paid_Leaves_Taken=totalPaidLeaves;
		existing_payroll.Total_Leaves_Taken=LeavesTaken;
		existing_payroll.Total_Hours_Worked=totalHoursWorked.toDecimal().round(2);
		existing_payroll.Lateness_Minutes=actualLateMinutes.toDecimal().round(2);
		existing_payroll.Lateness_Hours=(actualLateMinutes / 60).toDecimal().round(2);
		existing_payroll.Total_Overtime_Hours=totalovertime.toDecimal().round(2);
		existing_payroll.Hourly_Rate=per_hour_salary;
		existing_payroll.PerDay_Salary=per_day_salary;
		existing_payroll.Total_Allowances=Total_Allowances;
		existing_payroll.Late_Deductions=late_deduction;
		existing_payroll.Absent_Deductions=absent_deduction;
		existing_payroll.Holidays=Public_Holiday;
		existing_payroll.LWP_Deduction=lwp_deduction;
		existing_payroll.Missing_Hour_Deductions=0;
		existing_payroll.Permission_Minutes=totalPermissionMinutes.toDecimal().round(2);
		existing_payroll.Permission_Hours=(totalPermissionMinutes / 60).toDecimal().round(2);
		existing_payroll.Total_Regularizations=totalRegularizations;
		existing_payroll.Approved_Regularizations=approvedRegularizations;
		existing_payroll.Pending_Regularizations=pendingRegularizations;
		existing_payroll.Rejected_Regularizations=rejectedRegularizations;
		existing_payroll.Basic_Salary=employee_data.Basic_Salary;
		existing_payroll.Total_Deductions=total_deductions;
		existing_payroll.Gross_Salary=gross_salary;
		existing_payroll.Net_Salary=net_salary;
	}
	else
	{
		info "Creating new payroll for: " + empID;
		new_rec = insert into Salary_Register
		[
			Last_Calculation_Time=zoho.currenttime
			Employee_Name=employee_data.ID
			Select_Year=currentYear
			Select_Month=PayrollMonth
			Start_date=Starting_date
			End_Date=Ending_date
			Payroll_Status="Pending"
			Total_Days_Worked=totalPresentDays
			Total_Working_Days_This_Month=totalWorkingDays
			Total_Absent_Days=totalAbsentDays
			Total_Weekends=totalWeekends
			UnPaid_Leaves_Taken=totalUnpaid
			Paid_Leaves_Taken=totalPaidLeaves
			Total_Leaves_Taken=LeavesTaken
			Total_Hours_Worked=totalHoursWorked.toDecimal().round(2)
			Lateness_Minutes=actualLateMinutes.toDecimal().round(2)
			Lateness_Hours=(actualLateMinutes / 60).toDecimal().round(2)
			Total_Overtime_Hours=totalovertime.toDecimal().round(2)
			Basic_Salary=employee_data.Basic_Salary
			Hourly_Rate=per_hour_salary
			PerDay_Salary=per_day_salary
			Total_Allowances=Total_Allowances
			Gross_Salary=gross_salary
			Late_Deductions=late_deduction
			Absent_Deductions=absent_deduction
			Holidays=Public_Holiday
			LWP_Deduction=lwp_deduction
			Missing_Hour_Deductions=0
			Total_Deductions=total_deductions
			Permission_Minutes=totalPermissionMinutes.toDecimal().round(2)
			Permission_Hours=(totalPermissionMinutes / 60).toDecimal().round(2)
			Total_Regularizations=totalRegularizations
			Approved_Regularizations=approvedRegularizations
			Pending_Regularizations=pendingRegularizations
			Rejected_Regularizations=rejectedRegularizations
			Net_Salary=net_salary
			Added_User=zoho.loginuser
		];
	}
