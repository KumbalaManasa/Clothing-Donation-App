const { chromium } = require('../../frontend/node_modules/@playwright/test');
const path = require('path');
const fs = require('fs');

async function generatePdf() {
  const outputPath = path.resolve(__dirname, '../../../INTERVIEW_QUESTIONS.pdf');

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>WearForward - Technical Interview Preparation Guide</title>
  <style>
    @page {
      size: A4;
      margin: 1.8cm 1.5cm 1.8cm 1.5cm;
      @bottom-right {
        content: counter(page);
        font-size: 9pt;
        color: #718096;
      }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #2d3748;
      line-height: 1.55;
      font-size: 10.5pt;
      margin: 0;
      padding: 0;
    }
    .header {
      border-bottom: 2px solid #2b6cb0;
      padding-bottom: 12px;
      margin-bottom: 24px;
    }
    .title {
      font-size: 22pt;
      font-weight: 700;
      color: #1a365d;
      margin: 0 0 6px 0;
    }
    .subtitle {
      font-size: 12pt;
      color: #4a5568;
      margin: 0 0 10px 0;
    }
    .badge {
      display: inline-block;
      background: #ebf8ff;
      color: #2b6cb0;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 8.5pt;
      font-weight: 600;
      margin-right: 6px;
    }
    .cheat-sheet {
      background: #f7fafc;
      border-left: 4px solid #3182ce;
      padding: 12px 16px;
      margin-bottom: 24px;
      border-radius: 0 6px 6px 0;
    }
    .cheat-sheet h3 {
      margin-top: 0;
      margin-bottom: 8px;
      font-size: 11.5pt;
      color: #2c5282;
    }
    .cheat-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      font-size: 9.5pt;
    }
    .question-card {
      margin-bottom: 18px;
      page-break-inside: avoid;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 12px 16px;
      background: #ffffff;
    }
    .q-title {
      font-size: 11pt;
      font-weight: 700;
      color: #1a365d;
      margin: 0 0 8px 0;
    }
    .q-num {
      background: #3182ce;
      color: white;
      padding: 2px 7px;
      border-radius: 3px;
      font-size: 8.5pt;
      margin-right: 6px;
    }
    .answer {
      color: #333;
      margin: 0;
    }
    .code-tag {
      font-family: SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      background: #edf2f7;
      color: #805ad5;
      padding: 1px 5px;
      border-radius: 3px;
      font-size: 9pt;
    }
    .takeaway {
      margin-top: 8px;
      padding-top: 6px;
      border-top: 1px dashed #e2e8f0;
      font-size: 9pt;
      color: #4a5568;
    }
    .takeaway strong {
      color: #2b6cb0;
    }
    .page-break {
      page-break-before: always;
    }
  </style>
</head>
<body>

  <div class="header">
    <h1 class="title">WearForward (Clothing Donation App)</h1>
    <div class="subtitle">Technical Interview Preparation Guide & Codebase Cheat Sheet</div>
    <div>
      <span class="badge">React 19 + Vite</span>
      <span class="badge">Node.js + Express 5</span>
      <span class="badge">PostgreSQL + Knex</span>
      <span class="badge">JWT Auth</span>
      <span class="badge">Playwright + Vitest</span>
    </div>
  </div>

  <div class="cheat-sheet">
    <h3>Quick Project Architecture Summary</h3>
    <div class="cheat-grid">
      <div>
        <strong>Core Roles:</strong> Donor (creates listings), NGO (government-verified collector), Admin (moderator).<br/>
        <strong>Status Pipeline:</strong> Listed &rarr; Claimed &rarr; Picked Up &rarr; Distributed &rarr; Delivered.
      </div>
      <div>
        <strong>Database:</strong> PostgreSQL (7 tables: users, listings, listing_items, claims, distributions, notifications, password_resets).<br/>
        <strong>Concurrency:</strong> Optimistic locking, partial unique indexes, FOR UPDATE SKIP LOCKED.
      </div>
    </div>
  </div>

  <!-- QUESTIONS 1 to 5 -->
  <div class="question-card">
    <div class="q-title"><span class="q-num">Q1</span> What happens if two NGOs click "Claim" on the exact same donation at the exact same time?</div>
    <div class="answer">
      The system uses a <strong>two-layer concurrency defense</strong> so only one NGO wins, without any database corruption:
      <ol style="margin: 6px 0 0 18px; padding: 0;">
        <li><strong>Application Level (Optimistic Lock):</strong> In <span class="code-tag">src/services/listingStatusTransitions.js</span>, the update statement has a WHERE clause checking the current status: <span class="code-tag">UPDATE listings SET status='claimed' WHERE id=:id AND status='listed'</span>. The first NGO updates the row; the second finds 0 rows, throwing an <span class="code-tag">InvalidStatusTransitionError</span> that returns a clean <strong>409 Conflict</strong> (<em>"This listing was just claimed by someone else"</em>).</li>
        <li><strong>Database Level:</strong> A PostgreSQL partial unique index (<span class="code-tag">claims_active_listing_unique</span>) on <span class="code-tag">claims(listing_id) WHERE status = 'active'</span> mathematically guarantees the database will reject any second active claim.</li>
      </ol>
    </div>
    <div class="takeaway"><strong>Interview Key Point:</strong> We don't just rely on application code; we have an optimistic concurrency guard in Knex AND a database partial unique index.</div>
  </div>

  <div class="question-card">
    <div class="q-title"><span class="q-num">Q2</span> How is the 48-hour claim expiry background job implemented?</div>
    <div class="answer">
      In <span class="code-tag">src/jobs/claimExpiryJob.js</span>, a native Node.js <span class="code-tag">setInterval</span> runs every 5 minutes (configurable via <span class="code-tag">CLAIM_EXPIRY_JOB_INTERVAL_MS</span>).
      <br/>It executes <span class="code-tag">findStaleClaims</span> which finds all active claims where <span class="code-tag">picked_up_at IS NULL</span> and <span class="code-tag">expires_at &lt; now()</span> using <span class="code-tag">FOR UPDATE SKIP LOCKED</span>.
      For each stale claim, an isolated transaction sets the claim to <span class="code-tag">'expired'</span>, returns the listing to <span class="code-tag">'listed'</span>, and notifies both the NGO and donor.
    </div>
    <div class="takeaway"><strong>Interview Key Point:</strong> <span class="code-tag">FOR UPDATE SKIP LOCKED</span> ensures that if multiple backend instances run this job, they skip past already-locked rows and never process the same claim twice.</div>
  </div>

  <div class="question-card">
    <div class="q-title"><span class="q-num">Q3</span> How does government NGO verification work?</div>
    <div class="answer">
      Verification is <strong>synchronous and automated</strong> at signup in <span class="code-tag">src/routes/auth.js</span>. When an NGO registers, the system calls <span class="code-tag">verifyNgo(registration_number)</span> in <span class="code-tag">src/services/verifyNgo.js</span>.
      If approved, their account is immediately marked <span class="code-tag">verified</span>; otherwise, <span class="code-tag">not_verified</span>.
      There is <strong>no manual admin approval fallback</strong> by design to prevent human favoritism or bribery. Unverified NGOs can correct their number and resubmit via <span class="code-tag">POST /ngo/:id/reverify</span>.
    </div>
    <div class="takeaway"><strong>Interview Key Point:</strong> There is deliberately no admin route to flip verification status—trust is delegated strictly to official government registry data.</div>
  </div>

  <div class="question-card">
    <div class="q-title"><span class="q-num">Q4</span> Why does <span class="code-tag">requireVerifiedNgo</span> check the database instead of trusting the JWT token?</div>
    <div class="answer">
      JWT session tokens are valid for 24 hours. If an NGO's verification status changes (e.g., they edit their registration number to an invalid one or get revoked), the token stored in their browser would still carry the old role.
      To prevent unauthorized access to sensitive listings, <span class="code-tag">requireVerifiedNgo.js</span> checks the live PostgreSQL row on every request.
    </div>
    <div class="takeaway"><strong>Interview Key Point:</strong> Role is in the token, but critical verification state is queried live from the database to avoid stale permission loopholes.</div>
  </div>

  <div class="question-card">
    <div class="q-title"><span class="q-num">Q5</span> How do photo uploads work without Multer?</div>
    <div class="answer">
      The frontend converts images to base64 Data URIs (<span class="code-tag">data:image/png;base64,...</span>) using the browser's <span class="code-tag">FileReader.readAsDataURL()</span>.
      These are sent inside standard JSON bodies to <span class="code-tag">POST /listings/upload-photo</span>. Express is configured with <span class="code-tag">express.json({ limit: '8mb' })</span> to allow large base64 strings.
      In <span class="code-tag">src/services/localImageStorage.js</span>, the server validates the MIME type (PNG, JPEG, WebP, GIF), caps the size at 5MB, generates a server-side UUID filename, and saves it to disk or uploads it to S3/Cloudinary.
    </div>
    <div class="takeaway"><strong>Interview Key Point:</strong> Avoiding multipart/form-data simplified API testing and mobile client integration, while server-generated UUID filenames eliminate path traversal attacks.</div>
  </div>

  <div class="page-break"></div>

  <!-- QUESTIONS 6 to 10 -->
  <div class="question-card">
    <div class="q-title"><span class="q-num">Q6</span> Explain the 5-step status pipeline of a donation.</div>
    <div class="answer">
      Enforced by the finite state machine in <span class="code-tag">src/services/listingStatusTransitions.js</span>:
      <ol style="margin: 4px 0 0 18px; padding: 0;">
        <li><strong>Listed:</strong> Donor creates bundle with items, photo, and address.</li>
        <li><strong>Claimed:</strong> Verified NGO claims the bundle; 48-hour pickup clock starts.</li>
        <li><strong>Picked Up:</strong> NGO confirms physical collection from the donor's address.</li>
        <li><strong>Distributed:</strong> NGO delivers clothes to receiver and logs non-identifying recipient info.</li>
        <li><strong>Delivered:</strong> System automatically marks final status and generates a donor confirmation note.</li>
      </ol>
      A donor can cancel only before pickup; if a claim reaches 48h without pickup, it expires back to <em>Listed</em>.
    </div>
    <div class="takeaway"><strong>Interview Key Point:</strong> Illegal status jumps (e.g., Listed directly to Delivered) are rejected by the state machine code.</div>
  </div>

  <div class="question-card">
    <div class="q-title"><span class="q-num">Q7</span> Why are "Distributed" and "Delivered" updated together in <span class="code-tag">POST /claims/:id/distribute</span>?</div>
    <div class="answer">
      In real life, handing clothes to a recipient is both distribution and delivery at the same moment. In <span class="code-tag">src/routes/claims.js</span>, the single database transaction writes the <span class="code-tag">distributions</span> record, transitions the listing through <span class="code-tag">distributed &rarr; delivered</span>, and marks the claim <span class="code-tag">fulfilled</span>. The user never sees a half-finished intermediate state.
    </div>
    <div class="takeaway"><strong>Interview Key Point:</strong> Atomic transactions ensure data integrity so distribution records and delivered status are never out of sync.</div>
  </div>

  <div class="question-card">
    <div class="q-title"><span class="q-num">Q8</span> Why is there an explicit 1ms offset on notifications in the distribution transaction?</div>
    <div class="answer">
      In PostgreSQL, <span class="code-tag">now()</span> returns the start timestamp of the entire transaction, which is identical for all statements in that block.
      Because both the <em>distributed</em> and <em>delivered</em> notifications are inserted in the same transaction, they would get identical timestamps.
      Using <span class="code-tag">now() + interval '1 millisecond'</span> for the delivered notification preserves their exact display order on the user's screen.
    </div>
    <div class="takeaway"><strong>Interview Key Point:</strong> Shows deep knowledge of PostgreSQL transaction semantics and timestamp behavior.</div>
  </div>

  <div class="question-card">
    <div class="q-title"><span class="q-num">Q9</span> How are passwords hashed and reset securely?</div>
    <div class="answer">
      Passwords use <span class="code-tag">bcryptjs</span> with 10 salt rounds.
      For password recovery (<span class="code-tag">src/services/passwordReset.js</span>), the user can choose a 6-digit code or a 32-byte hex link token.
      <strong>The server never stores raw reset codes or tokens</strong>; it stores only their bcrypt hash in <span class="code-tag">password_resets.secret_hash</span> with a 15-minute expiration timestamp.
    </div>
    <div class="takeaway"><strong>Interview Key Point:</strong> Reset tokens are treated with the exact same security posture as passwords—hashed before persisting to disk.</div>
  </div>

  <div class="question-card">
    <div class="q-title"><span class="q-num">Q10</span> How does test isolation work across all 55 integration test files?</div>
    <div class="answer">
      The test harness in <span class="code-tag">scripts/run-tests.js</span> connects to a dedicated <span class="code-tag">TEST_DATABASE_URL</span>.
      Before running tests, it runs all Knex migrations and executes:
      <br/><span class="code-tag">TRUNCATE TABLE users, listings, listing_items, claims, distributions, notifications RESTART IDENTITY CASCADE</span>.
      This ensures each test run starts from a completely clean slate and never touches developer data.
    </div>
    <div class="takeaway"><strong>Interview Key Point:</strong> Test isolation is guaranteed by database-level truncation, not by relying on individual test cleanup callbacks.</div>
  </div>

  <div class="page-break"></div>

  <!-- QUESTIONS 11 to 15 -->
  <div class="question-card">
    <div class="q-title"><span class="q-num">Q11</span> What prevents donors' exact home GPS coordinates from leaking to browsing NGOs?</div>
    <div class="answer">
      In <span class="code-tag">GET /listings/open</span> (<span class="code-tag">src/routes/listings.js</span>), NGOs browse listings within a 15km radius.
      The backend computes proximity using the Haversine formula, but strips <span class="code-tag">pickup_lat</span> and <span class="code-tag">pickup_lng</span> from the output using object destructuring:
      <br/><span class="code-tag">const masked = result.map(({ pickup_lat, pickup_lng, ...rest }) =&gt; rest)</span>.
      The NGO only receives the exact address and location pin <em>after</em> they officially claim the listing.
    </div>
    <div class="takeaway"><strong>Interview Key Point:</strong> Strict data masking at the API layer protects donor privacy and security against scraping or uninvited visits.</div>
  </div>

  <div class="question-card">
    <div class="q-title"><span class="q-num">Q12</span> Why is there an Admin role if admin accounts cannot sign up through the app?</div>
    <div class="answer">
      Admin accounts have sensitive powers: listing deletion, stale claim monitoring, and NGO audit log access.
      Allowing public admin self-service signup would be a severe security flaw.
      Admin accounts must be provisioned directly by a database administrator or seeded via <span class="code-tag">seeds/001_dev_users.js</span> / <span class="code-tag">scripts/add-admin.js</span>.
    </div>
    <div class="takeaway"><strong>Interview Key Point:</strong> Adheres to the principle of least privilege—admin credentials cannot be created via public HTTP endpoints.</div>
  </div>

  <div class="question-card">
    <div class="q-title"><span class="q-num">Q13</span> How does the offline reverse-geocoding service work?</div>
    <div class="answer">
      In <span class="code-tag">src/services/reverseGeocode.js</span>, instead of calling a third-party paid API (which could fail, rate-limit, or require internet in local dev/CI), coordinates are matched against 5 bundled Bangalore reference points (Koramangala, Indiranagar, MG Road, Whitefield, Jayanagar).
      If within ~5km, it returns the neighborhood name; otherwise, it falls back to <span class="code-tag">"Near lat, lng"</span>. Donors can also edit this text before submitting.
    </div>
    <div class="takeaway"><strong>Interview Key Point:</strong> Eliminates third-party API dependencies during CI and local development while keeping the architecture modular.</div>
  </div>

  <div class="question-card">
    <div class="q-title"><span class="q-num">Q14</span> How does the backend prevent database error details from leaking to users?</div>
    <div class="answer">
      In <span class="code-tag">index.js</span>, after all routes are declared, a centralized 4-argument Express error handler is registered:
      <br/><span class="code-tag">app.use((err, req, res, next) =&gt; { console.error(err); res.status(500).json({ message: 'Internal server error' }); })</span>.
      Express 5 automatically catches unhandled promise rejections from async route handlers, ensuring unexpected SQL crashes return clean JSON rather than raw stack traces.
    </div>
    <div class="takeaway"><strong>Interview Key Point:</strong> Express 5 native async error forwarding ensures no database internals or server paths leak to clients.</div>
  </div>

  <div class="question-card">
    <div class="q-title"><span class="q-num">Q15</span> How does the frontend keep users logged in when they refresh the browser?</div>
    <div class="answer">
      In <span class="code-tag">Code/frontend/src/context/AuthContext.jsx</span>, authentication state is mirrored in browser <span class="code-tag">localStorage</span> under <span class="code-tag">donation-app.auth</span>.
      During the synchronous initialization phase of <span class="code-tag">AuthProvider</span>, it reads from storage and immediately calls <span class="code-tag">setAuthToken(token)</span> in <span class="code-tag">api/client.js</span>.
      This ensures that initial on-mount HTTP requests from child components already have the <span class="code-tag">Authorization: Bearer</span> header attached without racing a <span class="code-tag">useEffect</span>.
    </div>
    <div class="takeaway"><strong>Interview Key Point:</strong> Synchronous token injection avoids race conditions where child components fire unauthenticated API requests on initial page load.</div>
  </div>

</body>
</html>
  `;

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: 'load' });
  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '1.5cm',
      right: '1.2cm',
      bottom: '1.5cm',
      left: '1.2cm',
    },
  });
  await browser.close();
  console.log(`Successfully generated PDF at: ${outputPath}`);
}

generatePdf().catch((err) => {
  console.error('PDF generation failed:', err);
  process.exit(1);
});
