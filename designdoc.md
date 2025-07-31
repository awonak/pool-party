# Pool Party - A Dynamic Group Funding Pool Website

## Problem Statement

We have several office kegerators that are available for everyone to use. We need to find the budget to pay for new kegs. Previously we listed a paypal link for folks to donate, but this was not transparent. We want to improve the process by creating a website that makes it easy for users to donate and will be more transparent in showing how many donations are received and how each kegerator is funded. This helps us know where to prioritize which kegerators to refill and gives users confidence that their donations are being used effectively and appropriately.

## Design (Abstraction)

A simple, dynamic website with defined purpose funding pools where users can make donations, choosing how to allocate across the pools, and see the transparent progress of each funding pool.

This site will display a collection of funding pools created by the moderators. Funding pools can be added, modified, or removed by authenticated and authorized moderators on a Create/Edit Funding Pool page. If a pool has a current amount via the ledger, it cannot be removed.

The site will display each pool with the fund name and a bar chart representing the current amount donated to that pool, indicating progress toward or past a funding goal. The progress bar will indicate how much more is needed to reach the goal (similar to GoFundMe) and once that amount is reached or exceeded, the progress bar will continue to show the total amount collected, with a visual indicator showing where the goal is relative to the total amount (like a notch in the progress par that shows where the goal is relative to the total amount collected).

The site will be public. When users donate, they can either authenticate with a Google Account, or make an anonymous donation.

When the user clicks the Donation Button, they are taken to the donation page, where each funding pool is listed with an input box where they can provide a dollar amount to each individual pool. At the bottom of the list, the donation sum will be displayed. There will be a text field for the user to add a note along with their donation. There will be a PayPal link to send that donation sum to the PayPal account associated with the site instance. The site should be integrated with the PayPal webhooks to capture whether or not the transaction was successful. Successful transactions will be recorded in the ledger and be redirected to the Ledger page where they can see their donation added to the list of transactions, along with a “Thank you” confirmation notification at the top of the page.

Moderators should be able to make "withdrawals" from the ledger, indicating which funding pools they have drawn from. There should be a restricted moderator page where they can indicate an amount they need to withdraw from the ledger and which funding pools they will be drawing from. This interaction only modifies the transaction ledger and will not interact with the PayPal integration because the actual bank account is disconnected from the app. A description of what the withdrawal is being used for must be provided.

There should be an audit log or a ledger that shows all transactions with the amount, timestamp, transaction type (withdrawal/deposit), and user. The ledger should be a page on the site so users can see all transactions. The ledger should show user’s first and last initial, not their email address, or “anonymous” if the user did not authenticate when they donated.

The project will be open source, making it easy for others to launch their own funding pool instance. The site will need to be dynamic and have a database for the dynamic data, and should be designed in a way that is easy to deploy to a cloud provider. The site style should be easy to theme using a few Sass.

## Pages

### Home Page
* Login Button/Current User
* Donation Button
* List of each pool

### Donation Page
* Login Button/Current User
* list of funding pool to donate to, with an amount field for each pool
* Display Sum of donations for all funding pool amounts
* Donate Now button (connected to PayPal payment processor)

### Ledger Page
* Notification upon successful transaction
* List of transactions
* Filtering / sorting

### Moderator Page (only accessible to authenticated & authorized moderators)
* List of funding pool to withdraw from, with an amount field for each pool.
* Description (what the withdrawal will be used for)
* Display sum of total withdrawl
* Validation to ensure withdrawal amounts do not exceed ledger value.
* Submit (disabled if input not valid)

### Data Models

#### Funding Pool
* Name (unique)
* Description
* Goal Amount

#### Ledger
* Ledger ID
* Transaction ID (for PayPal reconciliation)
* Amount
* Allocations: (a list of Allocation objects)
* Timestamp
* Transaction type (withdrawal / deposit)
* User (optional)
    * Google User ID (optional)
    * First Name
    * Last Initial
* Description (optional)
* Anonymous (bool)

#### Allocation
* Ledger ID
* Funding Pool ID
* Amount

## Architecture:

### Frontend (React):

* User interacts with the React application in the browser.
* React components make API requests to the Go backend.
* Handles UI rendering, user input, and displaying data.

### Backend (Go):

* Exposes RESTful APIs for handling requests from the React frontend.
* Handles user authentication and authorization.
* Interacts with database to read and write data.
* Processes PayPal webhooks to update the ledger.

### Database (Postgres):

* Stores user data, funding pool details, ledger transactions, and other application data.

### Deployment:

* Use a single Docker container to serve both a Go API and a React frontend via Cloud Run
* The Go backend is containerized with Docker and deployed to Cloud Run.
* The React frontend static assets are served by the Go server.
