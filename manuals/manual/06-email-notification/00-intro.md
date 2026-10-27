---
title: Email Notification
routes: []
sources: []
i18nPrefix: []
---

- When a post with email notification set in the BO is registered, an email is sent.

- For posts in general boards, the email is sent only when the post belongs to a board that is currently exposed on the front end through a linked menu.

- For posts in the **Announcement** board, the email is sent as long as the board is exposed on the front end, **regardless of whether it is linked to a menu or not**.

- Email notifications are sent to the target audience 1 hour after the post is published on the front end.

  - This is the **general post email** screen:

![General Post Email Notification](images/general-post-email-notification.png){width=6.79in}

- **Important notice post email** screen:

![Important Post Email Notification](images/important-post-email-notification.png){width=6.79in}

- The email is composed of Introduction, Body(Board Name, Title, Summary), and Footer.

- The **Intro** displays a greeting and a simple title about the post with a detailed link.

![Email Body](images/email-body.png){width=5.25in}

- The **Body** area displays the Title and Summary up to 500 characters, and shows information such as whether there are attachments in the post.

- The **Footer** area displays guidance text such as the source of the email and contact information.
