---
title: How eSIM provisioning works
description: "The parties that turn a plan choice into a working eSIM, in order: the consumer, the mobile network operator, the SM-DP+ server, the LPA on the device, and the eUICC chip it writes to."
---

# How eSIM provisioning works {#how-esim-provisioning-works}

Buying an eSIM sets five parties in motion, and they are the same five whether you buy from a carrier or from Kokio. Understanding them is what makes the rest of this documentation readable: [Kokio's own contracts](../contracts/overview.md) sit alongside this chain rather than replacing it, recording who owns the purchase while the provisioning itself runs the standard way.

![Diagram of the parties in eSIM provisioning. The user sends their plan choice to the mobile network operator, which orders a profile from the SM-DP+ server. The user starts the download through the LPA on their device, and the SM-DP+ delivers the profile to the eUICC chip. The LPA and the eUICC sit inside a box labelled user equipment. Below them, the GSMA certificate issuer certifies both the SM-DP+ and the eUICC manufacturer, and the manufacturer in turn certifies the eUICC.](../../resources/esim-working.png)

## The four steps {#the-four-steps}

| Step | Who acts | What happens |
|---|---|---|
| 0 | The user | Picks a telco or data plan from the list the operator offers. This is the only step a person sees |
| 1 | The mobile network operator | Orders the SM-DP+ to prepare an eSIM profile for that plan |
| 2 | The user | Starts the download, which the LPA on the device carries out |
| 3 | The SM-DP+ | Delivers the prepared profile to the eUICC chip, where it is installed |

## Who is who {#who-is-who}

| Party | What it is | Where it runs |
|---|---|---|
| Consumer | The person buying the plan | |
| MNO, Mobile Network Operator | The carrier selling the plan. It does not build the profile itself, it orders one | The operator's side |
| SM-DP+, Subscription Manager Data Preparation | The server that builds a profile with the carrier's information and credentials, stores it, and delivers it to a device | The operator's side |
| LPA, Local Profile Assistant | The software on the device that downloads, installs and manages profiles, and talks to the eUICC on their behalf | The phone |
| eUICC, embedded Universal Integrated Circuit Card | The chip that holds the installed profiles. It is what lets a device switch operators without a new SIM | The phone |
| EUM, eUICC Manufacturer | Makes the chip and issues it a certificate | Offline, before the device ships |
| GSMA CI, Certificate Issuer | The root of trust. It certifies the SM-DP+ as a server and the manufacturer as a sub-CA | Industry-wide |

The last two rows are why a profile cannot simply be forged. The SM-DP+ and the eUICC each hold a certificate chaining back to the GSMA, and neither will talk to something that does not. It is also the part a user has no say in, which is [the problem Kokio is answering](./problem.md).
