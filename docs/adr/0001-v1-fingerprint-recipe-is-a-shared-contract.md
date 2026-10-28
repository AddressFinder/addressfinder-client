# The `v1` fingerprint recipe is a shared contract

The API only HMACs the raw fingerprint string, so two libraries that compute "v1" differently give one browser two hashes under the same prefix, and linking a visit's sessions across the v3 widget (`addressfinder-api`'s `apiSession.js`) and v4 (this package) fails without any error. So any library that sends `v1:` must produce the same 11 signals in the same order, and a library that can't read a signal the same way must use a new prefix instead of a near copy. Each repo pins its output for one fixed set of signals in a test.
