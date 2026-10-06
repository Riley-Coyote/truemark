# Messages

Deploy with gateway JWT verification **off** (`--no-verify-jwt`). `/flush` verifies the functions key; `/sms/inbound` verifies Twilio's signature. All configuration is supplied by the function environment, as listed in ROUND-12. No credentials belong in the application or repository.

The local SQL and Node proofs use only fixtures. Simulated email/text never calls a provider. Email HTML and text bodies are stored in the outbox for team review.
