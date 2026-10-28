# The `v1` fingerprint recipe is a shared contract

More than one Addressfinder library sends a `v1:` fingerprint, and the API must see the same value for the same browser whichever one sent it. So any library that sends `v1:` produces the same 11 signals in the same order, and a library that can't read a signal the same way uses a new prefix instead of a near copy. Each implementation pins its output for one fixed set of signals in a test.
