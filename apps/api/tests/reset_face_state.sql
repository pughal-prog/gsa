DELETE FROM attendance WHERE source LIKE 'face%';
DELETE FROM attendance_events;
DELETE FROM face_enrolments;
DELETE FROM face_pairing_codes;
DELETE FROM face_devices;
