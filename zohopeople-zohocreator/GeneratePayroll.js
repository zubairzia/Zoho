// ── Button Code on Employee List Report ──
// No manual input needed — everything is calculated automatically
get_rec = Employee_Information[ID == input.Employee_Name];
// ── STEP 1: Get employee from the current record ──
// ── STEP 1: Get employee from the current record ──
empID = get_rec.Employee_ID;
currentDay = zoho.currentdate.getDay();
year = zoho.currentdate.getYear();
// ── Determine correct payroll month ──
// After 26th → new payroll period starts → use NEXT month
// Before 26th → still in current period → use CURRENT month
if(currentDay >= 26)
{
	payrollMonthDate = zoho.currentdate.addMonth(1);
	currentMonth = payrollMonthDate.toString("MMMM");
	year = payrollMonthDate.getYear();
	info "On/After 26th — Payroll Month: " + currentMonth + " " + year;
}
else
{
	currentMonth = zoho.currentdate.toString("MMMM");
	info "Before 26th — Payroll Month: " + currentMonth + " " + year;
}
currentDay = zoho.currentdate.toString("dd");
// keep as string for sync_end
// ── STEP 2: Calculate payroll period automatically ──
monthMap = Map();
monthMap.put("January",1);
monthMap.put("February",2);
monthMap.put("March",3);
monthMap.put("April",4);
monthMap.put("May",5);
monthMap.put("June",6);
monthMap.put("July",7);
monthMap.put("August",8);
monthMap.put("September",9);
monthMap.put("October",10);
monthMap.put("November",11);
monthMap.put("December",12);
monthNameMap = Map();
monthNameMap.put(1,"Jan");
monthNameMap.put(2,"Feb");
monthNameMap.put(3,"Mar");
monthNameMap.put(4,"Apr");
monthNameMap.put(5,"May");
monthNameMap.put(6,"Jun");
monthNameMap.put(7,"Jul");
monthNameMap.put(8,"Aug");
monthNameMap.put(9,"Sep");
monthNameMap.put(10,"Oct");
monthNameMap.put(11,"Nov");
monthNameMap.put(12,"Dec");
monthNum = monthMap.get(currentMonth);
selectedDate = (year + "-" + monthNum + "-01").toDate("yyyy-MM-dd");
prevMonthDate = selectedDate.addMonth(-1);
prevMonthNum = prevMonthDate.getMonth();
prevMonthYear = prevMonthDate.getYear();
sync_start = "26-" + monthNameMap.get(prevMonthNum) + "-" + prevMonthYear;
sync_end = "25-" + monthNameMap.get(monthNum) + "-" + year;
// For permissions and regularization APIs (requires numeric month)
prevMonthNumStr = if(prevMonthNum < 10,"0" + prevMonthNum,prevMonthNum.toString());
monthNumStr = if(monthNum < 10,"0" + monthNum,monthNum.toString());
sync_start_num = "26-" + prevMonthNumStr + "-" + prevMonthYear;
sync_end_num = "25-" + monthNumStr + "-" + year;
info "Payroll Period: " + sync_start + " to " + sync_end;
info "Employee: " + empID;
// ── STEP 3: Fetch full payroll period attendance from Zoho People ──
// This catches ALL changes including backdated leave approvals
attendance_data = invokeurl
[
	url :"https://people.zoho.sa/people/api/attendance/getUserReport?sdate=" + sync_start + "&edate=" + sync_end + "&empId=" + empID + "&dateFormat=dd-MM-yyyy"
	type :GET
	connection:"creator_people"
];
// ── STEP 4: Sync fetched data into Creator ──
if(attendance_data.get("error") == null)
{
	emp_data = Employee_Information[Employee_ID == empID];
	updated_count = 0;
	inserted_count = 0;
	skipped_count = 0;
	for each  datekey in attendance_data.keys()
	{
		recordData = attendance_data.get(datekey);
		existing_att = Attendance[Employee_Information == emp_data.ID && Date_field == datekey];
		if(existing_att.count() == 0)
		{
			// ── INSERT new record ──
			insert into Attendance
			[
				Added_User=zoho.loginuser
				Employee_Name=emp_data.Full_Name_in_English
				Employee_Information=emp_data.ID
				Date_field=datekey
				ShiftStartTime=if(recordData.get("ShiftStartTime") == "-",null,recordData.get("ShiftStartTime"))
				Status=if(recordData.get("Status") == "-",null,recordData.get("Status"))
				ShiftEndTime=if(recordData.get("ShiftEndTime") == "-",null,recordData.get("ShiftEndTime"))
				Work_hours=if(recordData.get("WorkingHours") == "-",null,recordData.get("WorkingHours"))
				TotalHours=if(recordData.get("TotalHours") == "-",null,recordData.get("TotalHours"))
				ShiftName=if(recordData.get("ShiftName") == "-",null,recordData.get("ShiftName"))
				OverTime=if(recordData.get("OverTime") == "-",null,recordData.get("OverTime"))
				FirstIn=if(recordData.get("FirstIn") == "-",null,recordData.get("FirstIn"))
				LastOut=if(recordData.get("LastOut") == "-",null,recordData.get("LastOut"))
				FirstIn_Location=if(recordData.get("FirstIn_Location") == "-",null,recordData.get("FirstIn_Location"))
				LastOur_Location=if(recordData.get("LastOut_Location") == "-",null,recordData.get("LastOut_Location"))
				Early_In=if(recordData.get("Early_In") == "-",null,recordData.get("Early_In"))
				Late_Out=if(recordData.get("Late_Out") == "-",null,recordData.get("Late_Out"))
			]
			inserted_count = inserted_count + 1;
			info "INSERT | " + datekey + " | " + recordData.get("Status");
		}
		else
		{
			// ── UPDATE only if something changed ──
			new_status = if(recordData.get("Status") == "-",null,recordData.get("Status"));
			new_totalHours = if(recordData.get("TotalHours") == "-",null,recordData.get("TotalHours"));
			new_firstIn = if(recordData.get("FirstIn") == "-",null,recordData.get("FirstIn"));
			new_lastOut = if(recordData.get("LastOut") == "-",null,recordData.get("LastOut"));
			new_overtime = if(recordData.get("OverTime") == "-",null,recordData.get("OverTime"));
			if(existing_att.Status != new_status || existing_att.TotalHours != new_totalHours || existing_att.FirstIn != new_firstIn || existing_att.LastOut != new_lastOut || existing_att.OverTime != new_overtime)
			{
				existing_att.Status=new_status;
				existing_att.TotalHours=new_totalHours;
				existing_att.FirstIn=new_firstIn;
				existing_att.LastOut=new_lastOut;
				existing_att.OverTime=new_overtime;
				existing_att.Work_hours=if(recordData.get("WorkingHours") == "-",null,recordData.get("WorkingHours"));
				existing_att.ShiftStartTime=if(recordData.get("ShiftStartTime") == "-",null,recordData.get("ShiftStartTime"));
				existing_att.ShiftEndTime=if(recordData.get("ShiftEndTime") == "-",null,recordData.get("ShiftEndTime"));
				existing_att.Early_In=if(recordData.get("Early_In") == "-",null,recordData.get("Early_In"));
				existing_att.Late_Out=if(recordData.get("Late_Out") == "-",null,recordData.get("Late_Out"));
				updated_count = updated_count + 1;
				info "UPDATE | " + datekey + " | " + existing_att.Status + " → " + new_status;
			}
			else
			{
				skipped_count = skipped_count + 1;
				info "SKIPPED | " + datekey + " | No change";
			}
		}
	}
	info "Sync Complete | Inserted: " + inserted_count + " | Updated: " + updated_count + " | Skipped: " + skipped_count;
}
else
{
	info "Sync ERROR: " + attendance_data.get("error");
	return;
}
// ══════════════════════════════════════════════
// STEP 5: Sync hourly permissions for full payroll period
// Catches backdated permission submissions and approvals
// ══════════════════════════════════════════════
perm_response = invokeurl
[
	url :"https://people.zoho.sa/people/api/attendance/getPermissionRequests?sDate=" + sync_start_num + "&eDate=" + sync_end_num
	type :GET
	connection:"creator_people"
];
if(perm_response.get("message") == "Success" && perm_response.get("status") == "0")
{
	result = perm_response.get("result");
	permissionList = result.get("list");
	perm_updated = 0;
	perm_inserted = 0;
	perm_skipped = 0;
	info "Total Permission Requests Found: " + permissionList.size();
	for each  perm in permissionList
	{
		// Only process permissions for this specific employee
		if(perm.get("employeeId") != empID)
		{
			continue;
		}
		permissionId = perm.get("permissionId");
		approvalStatus = perm.get("approvalStatus");
		existing = Hourly_Permissions[Permission_ID == permissionId && Employee_ID == empID];
		if(existing.ID == null)
		{
			insert into Hourly_Permissions
			[
				Form_ID=perm.get("formId")
				Permission_ID=permissionId
				Employee_ID=perm.get("employeeId")
				Employee_Name=perm.get("employeeName")
				Permission_date=perm.get("date")
				Total_Time=perm.get("totalTime")
				fromTime=perm.get("fromTime")
				toTime=perm.get("toTime")
				Approval_Status=approvalStatus
				Reason=perm.get("reason")
				Added_User=zoho.loginuser
			]
			perm_inserted = perm_inserted + 1;
			info "Permission INSERT | " + perm.get("date") + " | " + approvalStatus;
		}
		else if(existing.Approval_Status != approvalStatus)
		{
			existing.Approval_Status=approvalStatus;
			existing.Total_Time=perm.get("totalTime");
			existing.toTime=perm.get("toTime");
			existing.Reason=perm.get("reason");
			perm_updated = perm_updated + 1;
			info "Permission UPDATE | " + perm.get("date") + " | " + existing.Approval_Status + " → " + approvalStatus;
		}
		else
		{
			perm_skipped = perm_skipped + 1;
		}
	}
	info "Permissions Sync Complete | Inserted: " + perm_inserted + " | Updated: " + perm_updated + " | Skipped: " + perm_skipped;
}
else
{
	info "Permissions Sync ERROR: " + perm_response;
}
// ══════════════════════════════════════════════
// STEP 6: Sync regularization requests for full payroll period
// Purpose: Keep Creator records up to date for audit trail
// Note: Payroll does NOT use regularization directly —
//       approved regularizations update attendance in Zoho People
//       which is then picked up by the attendance sync above
// ══════════════════════════════════════════════
reg_param = Map();
reg_param.put("fromdate",sync_start_num);
reg_param.put("todate",sync_end_num);
reg_param.put("dateFormat","dd-MM-yyyy");
reg_param.put("range","200");
reg_response = invokeurl
[
	url :"https://people.zoho.sa/people/api/attendance/getRegularizationRecords"
	type :GET
	parameters:reg_param
	connection:"creator_people"
];
if(reg_response.get("status") == 0)
{
	reg_result = reg_response.get("result");
	if(reg_result == null || reg_result.isEmpty() == true)
	{
		info "No regularization records found for period.";
	}
	else
	{
		reg_inserted = 0;
		reg_updated = 0;
		reg_skipped = 0;
		for each  rec in reg_result
		{
			// Only process for this specific employee
			if(rec.get("employeeId") != empID)
			{
				continue;
			}
			recordId = rec.get("recordId");
			approvalStatus = rec.get("approvalStatus");
			// Normalize overall approval status
			if(approvalStatus == "Waiting for approval")
			{
				normalizedRegStatus = "Pending";
			}
			else if(approvalStatus == "Approved" || approvalStatus == "Accepted")
			{
				normalizedRegStatus = "Approved";
			}
			else if(approvalStatus == "Rejected" || approvalStatus == "Denied")
			{
				normalizedRegStatus = "Rejected";
			}
			else
			{
				normalizedRegStatus = approvalStatus;
			}
			// ── Loop through ALL regDetails — one record per date ──
			regDetailsList = rec.get("regDetails");
			for each  regDetail in regDetailsList
			{
				regDetailsId = regDetail.get("regDetailsId");
				indApproval = regDetail.get("indApprovalStatus");
				regDate = regDetail.get("date");
				// Normalize per-day approval status
				if(indApproval == "Waiting for approval")
				{
					normalizedIndStatus = "Pending";
				}
				else if(indApproval == "Approved" || indApproval == "Accepted")
				{
					normalizedIndStatus = "Approved";
				}
				else if(indApproval == "Rejected" || indApproval == "Denied")
				{
					normalizedIndStatus = "Rejected";
				}
				else
				{
					normalizedIndStatus = indApproval;
				}
				// Convert newTotalHours from seconds to HH:mm
				newTotalHoursRaw = ifnull(regDetail.get("newTotalHours"),0).toLong();
				oldTotalHoursRaw = ifnull(regDetail.get("oldTotalHours"),0).toLong();
				// Check duplicate by regDetailsId + employeeId
				existing_reg = Regularization_Requests[regDetailsId == regDetail.get("regDetailsId") && employeeId == empID];
				if(existing_reg.ID == null)
				{
					insert into Regularization_Requests
					[
						recordId=recordId
						regDetailsId=regDetailsId
						ApprovalStatus=normalizedRegStatus
						indApprovalStatus=normalizedIndStatus
						employeeName=rec.get("employeeName")
						employeeId=empID
						employeeErecno=rec.get("employeeErecno")
						startDate=rec.get("startDate")
						endDate=ifnull(rec.get("endDate"),rec.get("startDate"))
						Date_field=regDate
						newCheckInTime=regDetail.get("newCheckInTime")
						newCheckOutTime=regDetail.get("newCheckOutTime")
						newAttStatus=regDetail.get("newAttStatus")
						oldAttStatus=regDetail.get("oldAttStatus")
						oldCheckInTime=regDetail.get("oldCheckInTime")
						newTotalHours1=newTotalHoursRaw
						oldTotalHours1=oldTotalHoursRaw
						reason=ifnull(regDetail.get("reason"),"")
						reason_notEnc=ifnull(regDetail.get("reason_notEnc"),"")
						desc=ifnull(regDetail.get("desc"),"")
						desc_notEnc=ifnull(regDetail.get("desc_notEnc"),"")
						Added_User=zoho.loginuser
					]
					reg_inserted = reg_inserted + 1;
					info "Reg INSERT | " + rec.get("employeeName") + " | " + regDate + " | " + normalizedRegStatus;
				}
				else if(existing_reg.ApprovalStatus != normalizedRegStatus || existing_reg.indApprovalStatus != normalizedIndStatus || existing_reg.newCheckInTime != regDetail.get("newCheckInTime") || existing_reg.newCheckOutTime != regDetail.get("newCheckOutTime") || existing_reg.newAttStatus != regDetail.get("newAttStatus"))
				{
					existing_reg.ApprovalStatus=normalizedRegStatus;
					existing_reg.indApprovalStatus=normalizedIndStatus;
					existing_reg.newCheckInTime=regDetail.get("newCheckInTime");
					existing_reg.newCheckOutTime=regDetail.get("newCheckOutTime");
					existing_reg.newAttStatus=regDetail.get("newAttStatus");
					existing_reg.newTotalHours1=newTotalHoursRaw;
					existing_reg.oldTotalHours1=oldTotalHoursRaw;
					reg_updated = reg_updated + 1;
					info "Reg UPDATE | " + rec.get("employeeName") + " | " + regDate + " | → " + normalizedRegStatus;
				}
				else
				{
					reg_skipped = reg_skipped + 1;
					info "Reg SKIPPED | " + rec.get("employeeName") + " | " + regDate + " | No change";
				}
			}
		}
		info "Regularization Sync Complete | Inserted: " + reg_inserted + " | Updated: " + reg_updated + " | Skipped: " + reg_skipped;
	}
}
else
{
	info "Regularization Sync ERROR: " + reg_response.get("message");
}
// ══════════════════════════════════════════════
// STEP 6B: Sync leave records for full payroll period
// ONE API call for this specific employee
// Catches backdated leave submissions and approvals
// ══════════════════════════════════════════════
leave_param = Map();
leave_param.put("from",sync_start_num);
leave_param.put("to",sync_end_num);
leave_param.put("dateFormat","dd-MM-yyyy");
leave_param.put("limit","200");
leave_param.put("dataSelect","ALL");
leave_param.put("approvalStatus","[\"APPROVED\",\"PENDING\",\"REJECTED\",\"CANCELLED\"]");
// Filter by this specific employee using Zoho_People_ID
emp_for_leave = Employee_Information[Employee_ID == empID];
if(emp_for_leave.Zoho_People_ID != null && emp_for_leave.Zoho_People_ID != "")
{
	leave_param.put("employee","[\"" + emp_for_leave.Zoho_People_ID + "\"]");
}
leave_response = invokeurl
[
	url :"https://people.zoho.sa/api/v2/leavetracker/leaves/records"
	type :GET
	parameters:leave_param
	connection:"creator_people"
];
leave_records = leave_response.get("records");
if(leave_records == null || leave_records.isEmpty() == true)
{
	info "No leave records found for period | Employee: " + empID;
}
else
{
	leave_inserted = 0;
	leave_updated = 0;
	leave_skipped = 0;
	for each  leaveID in leave_records.keys()
	{
		leaveRecord = leave_records.get(leaveID);
		zohoID = leaveRecord.get("Zoho.ID").toString();
		employeeName = leaveRecord.get("Employee");
		employeeID = leaveRecord.get("Employee.ID").toString();
		leaveType = leaveRecord.get("Leavetype");
		leaveTypeID = leaveRecord.get("Leavetype.ID").toString();
		leaveUnit = leaveRecord.get("Unit");
		leavePayType = leaveRecord.get("Type");
		approvalStatus = leaveRecord.get("ApprovalStatus");
		reason = ifnull(leaveRecord.get("Reason"),"");
		fromDateLeave = leaveRecord.get("From");
		toDateLeave = leaveRecord.get("To");
		dateOfRequest = leaveRecord.get("DateOfRequest");
		// ── Normalize approval status ──
		if(approvalStatus == "APPROVED" || approvalStatus == "Approved")
		{
			normalizedLeaveStatus = "Approved";
		}
		else if(approvalStatus == "PENDING" || approvalStatus == "Pending")
		{
			normalizedLeaveStatus = "Pending";
		}
		else if(approvalStatus == "REJECTED" || approvalStatus == "Rejected")
		{
			normalizedLeaveStatus = "Rejected";
		}
		else if(approvalStatus == "CANCELLED" || approvalStatus == "Cancelled")
		{
			normalizedLeaveStatus = "Cancelled";
		}
		else
		{
			normalizedLeaveStatus = approvalStatus;
		}
		// ── Find employee in Creator ──
		emp_leave_data = Employee_Information[Zoho_People_ID == employeeID];
		if(emp_leave_data.count() == 0)
		{
			info "Leave: Employee not found | Zoho ID: " + employeeID + " | " + employeeName;
			continue;
		}
		// ── Calculate total days from Days map ──
		daysMap = leaveRecord.get("Days");
		totalDays = 0.0;
		for each  dayKey in daysMap.keys()
		{
			dayData = daysMap.get(dayKey);
			leaveCount = ifnull(dayData.get("LeaveCount"),"0").toDecimal();
			totalDays = totalDays + leaveCount;
		}
		// ── Check duplicate ──
		existing_leave = Leaves[Zoho_ID == zohoID];
		if(existing_leave.ID == null)
		{
			// ── INSERT ──
			insert into Leaves
			[
				Zoho_ID=zohoID
				Employee_Information=emp_leave_data.ID
				EmployeeID=emp_leave_data.Employee_ID
				Leavetype=leaveType
				LeavetypeID=leaveTypeID
				Leave_Unit=leaveUnit
				Pay_Type=leavePayType
				Approval_Status=normalizedLeaveStatus
				Reasonforleave=reason
				From_Date=fromDateLeave.toDate("dd-MM-yyyy")
				To_Date=toDateLeave.toDate("dd-MM-yyyy")
				Date_Of_Request=dateOfRequest
				Daystaken=totalDays.toDecimal().round(2)
				Added_User=zoho.loginuser
			]
			leave_inserted = leave_inserted + 1;
			info "Leave INSERT | " + employeeName + " | " + leaveType + " | " + fromDateLeave + " | " + normalizedLeaveStatus;
		}
		else if(existing_leave.Approval_Status != normalizedLeaveStatus || existing_leave.Daystaken != totalDays.toDecimal().round(2))
		{
			// ── UPDATE ──
			existing_leave.Approval_Status=normalizedLeaveStatus;
			existing_leave.Daystaken=totalDays.toDecimal().round(2);
			existing_leave.To_Date=toDateLeave.toDate("dd-MM-yyyy");
			leave_updated = leave_updated + 1;
			info "Leave UPDATE | " + employeeName + " | " + leaveType + " | " + fromDateLeave + " | → " + normalizedLeaveStatus;
		}
		else
		{
			leave_skipped = leave_skipped + 1;
			info "Leave SKIPPED | " + employeeName + " | " + leaveType + " | No change";
		}
	}
	info "Leave Sync Complete | Inserted: " + leave_inserted + " | Updated: " + leave_updated + " | Skipped: " + leave_skipped;
}
// ── STEP 7: Now run payroll on 100% fresh data ──
info "Starting payroll calculation for: " + empID;
thisapp.People.NewLatestPayroll(currentMonth,empID);
