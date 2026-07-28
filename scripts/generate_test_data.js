const stamp = Date.now().toString().slice(-8);

output.testEmail = `leak.qa.${stamp}@example.com`;
output.testPhone = `0917${stamp.slice(-7)}`;
output.fullName = `MAESTRO QA ${stamp}`;
output.landmark = `MAESTRO REGRESSION LANDMARK ${stamp}`;
output.reportMarker = `MAESTRO-${stamp}`;
