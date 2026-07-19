// This code runs daily and fetches attendance data for each employee for the last day
void People.getAttendance()
{
	// Get today's date
	// API call
	allEmployees = Employee_Information[ID != null];
	for each  emp in allEmployees
	{
		empID = emp.Employee_ID;
		sdate = zoho.currentdate.subDay(1);
		edate = zoho.currentdate.subDay(1);
		attendance_data = invokeurl
		[
			url :"https://people.zoho.com/people/api/attendance/getUserReport?sdate=" + sdate + "&edate=" + edate + "&empId=" + empID + "&dateFormat=dd-MM-yyyy"
			type :GET
			connection:"creator_people"
		];
		if(attendance_data.get("error") == null)
		{
			for each  datekey in attendance_data.keys()
			{
				recordData = attendance_data.get(datekey);
				insert into Attendance
				[
					Added_User=zoho.loginuser
					Employee_Name=emp.Full_Name_in_English
					Employee_Information=emp.ID
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
			}
		}
	}
}
