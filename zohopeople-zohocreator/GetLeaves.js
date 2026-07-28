void People.GetLeaves()
{
	// ══════════════════════════════════════════════
	// LEAVE SYNC FUNCTION
	// Fetches ALL employees leave records in ONE API call
	// Avoids rate limit by not calling per employee
	// ══════════════════════════════════════════════
	fromDate = zoho.currentdate.subDay(1).toString("dd-MM-yyyy");
	toDate = zoho.currentdate.subDay(1).toString("dd-MM-yyyy");
	info "Fetching leaves for: " + fromDate;
	// ── ONE API call for ALL employees ──
	param = Map();
	param.put("from",fromDate);
	param.put("to",toDate);
	param.put("dateFormat","dd-MM-yyyy");
	param.put("limit","200");
	param.put("dataSelect","ALL");
	// ← fetches all employees at once
	param.put("approvalStatus","[\"APPROVED\",\"PENDING\",\"REJECTED\",\"CANCELLED\"]");
	response = invokeurl
	[
		url :"https://people.zoho.com/api/v2/leavetracker/leaves/records"
		type :GET
		parameters:param
		connection:"creator_people"
	];
	//     info "Leave API Response: " + response;
	// ── Guard: API error ──
	//     if(response.get("message") != "success" && response.get("message") != "Success")
	//     {
	//         info "Leave API Error: " + response;
	//         return;
	//     }
	records = response.get("records");
	// ── Guard: No records ──
	if(records == null || records.isEmpty() == true)
	{
		info "No leave records found for: " + fromDate;
		return;
	}
	inserted_count = 0;
	updated_count = 0;
	skipped_count = 0;
	// ── Loop through each leave record ──
	for each  leaveID in records.keys()
	{
		leaveRecord = records.get(leaveID);
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
			normalizedStatus = "Approved";
		}
		else if(approvalStatus == "PENDING" || approvalStatus == "Pending")
		{
			normalizedStatus = "Pending";
		}
		else if(approvalStatus == "REJECTED" || approvalStatus == "Rejected")
		{
			normalizedStatus = "Rejected";
		}
		else if(approvalStatus == "CANCELLED" || approvalStatus == "Cancelled")
		{
			normalizedStatus = "Cancelled";
		}
		else
		{
			normalizedStatus = approvalStatus;
		}
		// ── Find matching employee in Creator by Zoho_People_ID ──
		emp_data = Employee_Information[Zoho_People_ID == employeeID];
		if(emp_data.count() == 0)
		{
			info "Employee not found | Zoho ID: " + employeeID + " | " + employeeName;
			continue;
		}
		// ── Calculate total leave days from Days map ──
		daysMap = leaveRecord.get("Days");
		totalDays = 0.0;
		for each  dayKey in daysMap.keys()
		{
			dayData = daysMap.get(dayKey);
			leaveCount = ifnull(dayData.get("LeaveCount"),"0").toDecimal();
			totalDays = totalDays + leaveCount;
		}
		// ── Check duplicate by Zoho_ID ──
		existing_leave = Leaves[Zoho_ID == zohoID];
		if(existing_leave.ID == null)
		{
			// ── INSERT ──
			insert into Leaves
			[
				Zoho_ID=zohoID
				Employee_Information=emp_data.ID
				EmployeeID=emp_data.Employee_ID
				Leavetype=leaveType
				LeavetypeID=leaveTypeID
				Leave_Unit=leaveUnit
				Pay_Type=leavePayType
				Approval_Status=normalizedStatus
				Reasonforleave=reason
				From_Date=fromDateLeave.toDate("dd-MM-yyyy")
				To_Date=toDateLeave.toDate("dd-MM-yyyy")
				Date_Of_Request=dateOfRequest
				Daystaken=totalDays.toDecimal().round(2)
				Added_User=zoho.loginuser
			]
			inserted_count = inserted_count + 1;
			info "Leave INSERT | " + employeeName + " | " + leaveType + " | " + fromDateLeave + " | " + normalizedStatus;
		}
		else if(existing_leave.Approval_Status != normalizedStatus || existing_leave.Daystaken != totalDays.toDecimal().round(2))
		{
			// ── UPDATE ──
			existing_leave.Approval_Status=normalizedStatus;
			existing_leave.Daystaken=totalDays.toDecimal().round(2);
			existing_leave.To_Date=toDateLeave;
			updated_count = updated_count + 1;
			info "Leave UPDATE | " + employeeName + " | " + leaveType + " | " + fromDateLeave + " | → " + normalizedStatus;
		}
		else
		{
			// ── SKIP ──
			skipped_count = skipped_count + 1;
			info "Leave SKIPPED | " + employeeName + " | " + leaveType + " | No change";
		}
	}
	info "══════════════════════════════════════";
	info "Leave Sync Complete";
	info "Inserted : " + inserted_count;
	info "Updated  : " + updated_count;
	info "Skipped  : " + skipped_count;
	info "══════════════════════════════════════";
}
