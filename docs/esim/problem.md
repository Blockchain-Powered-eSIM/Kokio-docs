---
title: The problem with eSIMs
description: Why Kokio exists. eSIM provisioning is convenient, but it leaves consumer records in operator and manufacturer databases, with uneven standards and no way for a user to check what was written about them.
---

# The problem with eSIMs {#the-problem-with-esims}

Kokio was built because the convenience of eSIMs arrived with a set of security and privacy problems nobody has fixed. This page is the short version. [The wiki](https://github.com/Blockchain-Powered-eSIM/Kokio-docs/wiki/Problems-With-eSIMs) is the long one.

An eSIM removes the plastic card, which is genuinely useful for phones, watches and IoT devices. What it does not remove is the trust. A physical SIM is a thing you hold. An eSIM profile is a record in somebody else's system, delivered over the air, and it puts you in the hands of several parties you never chose:

- **Provisioning is the weak point.** A profile is created, delivered and activated remotely. Every step in that chain is a chance for it to be intercepted, misdirected or issued to the wrong person.
- **Standards are applied unevenly.** Implementations differ between operators and between manufacturers, so how secure your eSIM is depends on which combination you happen to own rather than on a floor everybody meets.
- **Social engineering still works.** Talking a support agent into moving a profile to a new device is far easier than breaking any of the cryptography, and it is how real SIM swap attacks happen.
- **You inherit the manufacturer's and the operator's key handling.** You cannot inspect it, you did not agree to it, and you have no recourse if it turns out to be careless.
- **Your record is theirs.** What you bought and when sits in a database you cannot read, verify or take with you.

Better standards, better user education and more careful practice from carriers would all help, and every one of them is out of a user's hands. The other route is to stop requiring the trust in the first place, which is [what Kokio does](./solution.md).
