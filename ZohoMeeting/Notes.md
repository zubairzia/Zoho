# Zoho Webinar Poll Sync

Synchronizes webinar poll responses from Zoho Meeting/Webinar to Zoho Creator.

## Features

- Fetch webinar attendee reports
- Extract attendee poll responses
- Store responses in Zoho Creator
- Prevent duplicate imports

## Data Retrieved

- Attendee Name
- Attendee Email
- Poll Question
- Poll Answer

## API Used

GET /api/v2/{zsoid}/attendee/{webinarKey}.json

## Requirements

- Zoho Creator
- Zoho Meeting API connection
- OAuth scopes for Webinar Reports
