## 2026-08-22T10:45:55+05:30

# Teamwork Project Prompt — Draft

> Status: Launched
> Requested team: Small, focused team

This is a single self-contained fix; keep it small and focused. The project involves refining the menu editing workflow in an existing Next.js application for users who have "request changes" permissions. First, add a toggle button inside the Menu Edit modal to hide distracting update logs for these users. Second, improve the UI to clearly distinguish between "requesting" changes and "approving" changes, ensuring that requests do not modify the actual menu until approved, while maintaining the existing design language.

Working directory: c:/COOKHOUSEADMIN-MAIN
Integrity mode: development

## Requirements

### R1. Update Log Toggle
Add a UI toggle inside the Menu Edit modal to show or hide the update logs (the live trail of changes). This toggle should default to hiding the logs for users who only have permission to request changes, reducing visual distraction.

### R2. Request vs. Approve UI Distinction
Enhance the Menu Edit modal to clearly communicate to the user when they are in "Request Mode" versus "Direct Edit Mode". This should involve frontend UI refinements—such as clear banners, distinct button states, or highlighting of pending changes—to make the workflow intuitive for both requesters and approvers, without altering the underlying backend logic or core design system.

## Acceptance Criteria

### UI and Usability
- [ ] When logged in as a user with only `CAN_REQUEST_CHANGES` permissions, opening the Menu Edit modal displays a toggle for the update log, and the log is hidden by default.
- [ ] Toggling the button successfully shows or hides the update log history in the modal.
- [ ] A clear banner or visual indicator is present in the modal informing the user that their changes will be submitted as a request for approval, rather than modifying the live menu immediately.
- [ ] The core design language and layout of the existing application remain intact.
