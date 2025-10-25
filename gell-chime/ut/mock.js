class Chime {

	createMeeting() {
		return {
			promise: z => when({
				Meeting: {
					// MeetingId: 'foo'
					"MeetingId": "36068fe1-2360-40e7-83bd-18b2bc6da337",
					"ExternalMeetingId": null,
					"MediaPlacement": {
						"AudioHostUrl": "5e9fc948e3ea48f5df1302b87b189f7a.k.m2.ue1.app.chime.aws:3478",
						"AudioFallbackUrl": "wss://haxrp.m2.ue1.app.chime.aws:443/calls/36068fe1-2360-40e7-83bd-18b2bc6da337",
						"ScreenDataUrl": "wss://bitpw.m2.ue1.app.chime.aws:443/v2/screen/36068fe1-2360-40e7-83bd-18b2bc6da337",
						"ScreenSharingUrl": "wss://bitpw.m2.ue1.app.chime.aws:443/v2/screen/36068fe1-2360-40e7-83bd-18b2bc6da337",
						"ScreenViewingUrl": "wss://bitpw.m2.ue1.app.chime.aws:443/ws/connect?passcode=null&viewer_uuid=null&X-BitHub-Call-Id=36068fe1-2360-40e7-83bd-18b2bc6da337",
						"SignalingUrl": "wss://signal.m2.ue1.app.chime.aws/control/36068fe1-2360-40e7-83bd-18b2bc6da337",
						"TurnControlUrl": "https://ccp.cp.ue1.app.chime.aws/v2/turn_sessions"
					},
					"MediaRegion": "us-east-1"
				}
			})
		}
	}

	createAttendee(params) {
		return {
			promise: z => when({
				Attendee: {
					ExternalUserId: params.ExternalUserId,
					// AttendeeId: 'foo',
					// JoinToken: 'mytoken'
					// "ExternalUserId": "djghokie+1@gmail.com",
					"AttendeeId": "24a76d59-97f1-5b47-30bc-3d3f6c55a9a9",
					"JoinToken": "MjRhNzZkNTktOTdmMS01YjQ3LTMwYmMtM2QzZjZjNTVhOWE5OjkzMzlhNGI4LTJlMWYtNGM1Ni05NDI0LTQzMGM5ZThiZGNlOQ"
				}
			})
		}
	}

}

module.exports = { Chime };