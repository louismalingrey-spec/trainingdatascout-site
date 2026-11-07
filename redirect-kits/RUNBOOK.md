# Warming-domain redirects on GitHub Pages

Prepared 2026-11-07. These files are ready to copy into four new repositories. They are not deployed. No GitHub repository was created, no DNS record was changed, and the landing site `trainingdatascout.com` was left as it is.

On 2026-11-07 the approved names `trainingdatascoutco-redirect`, `trainingdatascoutfirm-redirect`, `trainingdatascoutgroup-redirect`, and `trainingdatascoutpartners-redirect` were absent under `louismalingrey-spec` (HTTP 404). The cloud session is a GitHub App installation whose repository list contains only `trainingdatascout-site`. `GET /user` and `GET /user/repos` return `403 Resource not accessible by integration`, so this session cannot call the documented `POST /user/repos` as that user. Create the four public repositories while logged in as `louismalingrey-spec`, from https://github.com/new or with `gh repo create` using a token that has the `public_repo` or `repo` scope. Leave each repository empty, then push only the four site files below. Copy nothing from a DNS export into the repository.

The redirect in each kit is a browser redirect: a zero-delay meta refresh, `location.replace`, and a visible link. All three use the fixed URL `https://trainingdatascout.com/`. The warming host itself answers with the HTML page. That hop is not an HTTP 301.

## Architecture

`trainingdatascout-site` publishes GitHub Pages from branch `main`, folder `/`, with custom domain `trainingdatascout.com`, HTTPS enforced, and a certificate that lists `trainingdatascout.com` and `www.trainingdatascout.com` (approved, expiry 2027-02-01). The root `CNAME` file is `trainingdatascout.com`. The account `louismalingrey-spec` is a user account and has no `louismalingrey-spec.github.io` repository.

GitHub's custom-domain rules, from the docs fetched on 2026-11-07:

- A `CNAME` file at the publishing root contains one domain, and that domain is unique across GitHub Pages.
- One Pages site supports one apex. The supported companion is `www` on that same apex. GitHub redirects between those two names.
- A second apex has to be a different Pages site.
- Google Cloud DNS, which is the nameserver for all four warming zones, stores address records. It has no HTTP redirect record and no ALIAS/ANAME record.

Each warming apex therefore gets its own public repository, its own Pages site, and its own apex custom domain. The `www` hostname is a DNS `CNAME` on that same site. Typing a warming domain into the Pages settings of `trainingdatascout-site` would replace `trainingdatascout.com`. Use the new repositories only.

| Apex | New repository | Folder to publish as that repository root |
| --- | --- | --- |
| `trainingdatascoutco.com` | `louismalingrey-spec/trainingdatascoutco-redirect` | `redirect-kits/trainingdatascoutco.com/` |
| `trainingdatascoutfirm.com` | `louismalingrey-spec/trainingdatascoutfirm-redirect` | `redirect-kits/trainingdatascoutfirm.com/` |
| `trainingdatascoutgroup.com` | `louismalingrey-spec/trainingdatascoutgroup-redirect` | `redirect-kits/trainingdatascoutgroup.com/` |
| `trainingdatascoutpartners.com` | `louismalingrey-spec/trainingdatascoutpartners-redirect` | `redirect-kits/trainingdatascoutpartners.com/` |

Those repository names were unused on the account on 2026-11-07. The account's other repositories were `trainingdatascout-site` and `nanoclaw`.

Each folder contains `index.html`, `404.html` (the same page, so an unknown path still runs the redirect), `CNAME` (the apex only), and an empty `.nojekyll`. Publish with "Deploy from a branch". A GitHub Actions source ignores `CNAME`.

## Official address records

Fetched 2026-11-07 from [Managing a custom domain](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site) and [Securing your GitHub Pages site with HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https). The same values are in `github-pages-targets.json`.

Apex `A`:

```text
185.199.108.153
185.199.109.153
185.199.110.153
185.199.111.153
```

Apex `AAAA`:

```text
2606:50c0:8000::153
2606:50c0:8001::153
2606:50c0:8002::153
2606:50c0:8003::153
```

`www` `CNAME`: `louismalingrey-spec.github.io`

That `www` target is the documented `<user>.github.io` host for this account. It is the record already published for `www.trainingdatascout.com`. It does not include the repository name, and it is not a `*.pages.github.io` host. The landing apex already publishes the four `A` records above and has no apex `AAAA`. Leave the landing zone on its current nameservers (`launch1.spaceship.net` and `launch2.spaceship.net`). This work adds `AAAA` only on the warming zones, where Google Cloud DNS cannot use the ALIAS/ANAME alternative from the docs.

An extra `A` or `AAAA` on the apex, or a `www` record other than that `CNAME`, can stop Let's Encrypt from issuing the Pages certificate. Remove the current Mailpool address as part of the same cutover. The four warming zones currently have no `AAAA` and no `CAA` records.

## Records observed on 2026-11-07

Public address lookup on 2026-11-07. Export the zone from Mailpool workspace 6638 before editing and keep that export locally. This repository does not store the mail records. `trainingdatascoutfirm.com` and `trainingdatascoutpartners.com` both use the `ns-cloud-e` nameserver names and are separate zones; open the zone by domain name.

| Zone | Apex `A` and `www` `A` to remove | Nameservers, unchanged |
| --- | --- | --- |
| `trainingdatascoutco.com` | `35.208.109.108` | `ns-cloud-c1` through `ns-cloud-c4.googledomains.com` |
| `trainingdatascoutfirm.com` | `35.208.229.137` | `ns-cloud-e1` through `ns-cloud-e4.googledomains.com` |
| `trainingdatascoutgroup.com` | `35.209.3.54` | `ns-cloud-d1` through `ns-cloud-d4.googledomains.com` |
| `trainingdatascoutpartners.com` | `35.209.224.115` | `ns-cloud-e1` through `ns-cloud-e4.googledomains.com` |

On all four zones, `www` had only that `A` record. Each apex also had `MX`, SPF, a `google-site-verification` TXT, `_dmarc`, and `google._domainkey`. Leave every one of those records exactly as it is in the Mailpool export. Their TTL on the web address records was 5 seconds. HTTPS on all eight hostnames returned `200` from `Caddy` with `x-bot-barrier: challenge` and no `Location` header. The certificate presented for each apex listed only that apex.

## Order of work

Repeat the whole sequence for one domain before starting the next. The landing repository stays untouched throughout.

1. Create a new public repository under `louismalingrey-spec` with the name in the table. Leave it empty: no generated README, license, or `.gitignore`. Public matches the landing site and adds no plan or charge. Pages content is public even when a plan allows a private repository.

2. Copy the four files from the matching folder to the new repository root and push `main`. From a checkout of this kit:

```sh
DOMAIN=trainingdatascoutco.com
REPO=trainingdatascoutco-redirect
rm -rf "/tmp/$REPO"
mkdir "/tmp/$REPO"
cp "redirect-kits/$DOMAIN/index.html" "redirect-kits/$DOMAIN/404.html" \
   "redirect-kits/$DOMAIN/CNAME" "redirect-kits/$DOMAIN/.nojekyll" "/tmp/$REPO/"
git -C "/tmp/$REPO" init -b main
git -C "/tmp/$REPO" add index.html 404.html CNAME .nojekyll
git -C "/tmp/$REPO" commit -m "Publish the browser redirect to https://trainingdatascout.com/"
git -C "/tmp/$REPO" remote add origin "git@github.com:louismalingrey-spec/$REPO.git"
git -C "/tmp/$REPO" push -u origin main
```

Substitute the domain and repository from the table. Push only `/tmp/$REPO`. Pushing this landing checkout to that remote would publish the landing page on the warming domain.

3. In the new repository, open Settings, then Pages. Under Build and deployment, choose Deploy from a branch, branch `main`, folder `/ (root)`, and save. Wait until the Pages build is current. `https://louismalingrey-spec.github.io/<repository>/` then serves this HTML, and opening it lands on `https://trainingdatascout.com/`.

4. Verify the apex on the user account before the web addresses point at GitHub. The docs place this at profile Settings, then Pages, then Add a domain. Enter the apex, for example `trainingdatascoutco.com`, and not `www`. GitHub displays a `TXT` value there. Create that record in the matching zone:

| Host | Type | Value |
| --- | --- | --- |
| `_github-pages-challenge-louismalingrey-spec` | `TXT` | the value shown in the GitHub dialog |

The value is different for each domain and is shown only after the domain is entered. Keep the existing SPF and `google-site-verification` `TXT` records. Confirm:

```sh
dig _github-pages-challenge-louismalingrey-spec.trainingdatascoutco.com TXT
```

Return to the profile Pages page and choose Verify. Leave the `TXT` record in place. Verification covers the apex and its direct subdomain `www`, and it authorizes repositories owned by this user account.

5. In the new repository's Pages settings, set Custom domain to the apex and save. Leave Enforce HTTPS unchecked. The root `CNAME` must remain one line containing that apex. `www` is not written in `CNAME`; GitHub uses it as the companion host when its DNS `CNAME` is in place.

6. Export the zone from Mailpool and keep it outside this repository. After the address edit, the export's `MX`, SPF, `google-site-verification`, `_dmarc`, and `google._domainkey` records must still match the zone.

7. Change only the web address records. Nameservers stay on the Google Cloud DNS hosts already published.

Apex, in the row editor host `@` or the bare domain:

- Add the four `A` records and four `AAAA` records listed above. TTL `300` is enough for a short rollback window.
- Remove the single Mailpool `A` listed for this zone. While that address remains, certificate issuance stays blocked.
- Leave `MX` and both apex `TXT` records in place. An apex `CNAME` is the wrong record for this DNS host and would collide with `MX` and `TXT`.

`www`:

- Remove the Mailpool `A`. `www` has no `MX` or `TXT`, so the name can become a `CNAME`.
- Add `CNAME` `louismalingrey-spec.github.io`. Use a trailing dot if the editor stores a fully qualified name. A `CNAME` cannot share the name with the old `A`, so remove the `A` first when the editor requires that order.
- The `CNAME` target is the GitHub user host. `trainingdatascout.com` and the warming apex are the wrong targets.

8. Confirm public DNS before expecting a certificate:

```sh
dig trainingdatascoutco.com +noall +answer A
dig trainingdatascoutco.com +noall +answer AAAA
dig www.trainingdatascoutco.com +noall +answer CNAME
dig trainingdatascoutco.com +noall +answer MX
dig trainingdatascoutco.com +noall +answer TXT
```

The address answers are the eight GitHub records, `www` is only the `CNAME`, and `MX` and `TXT` still match the export. Docs allow up to 24 hours for DNS even though these records were published at TTL 5.

9. Issue the certificate, then require HTTPS. Saving the custom domain starts GitHub's DNS check. When the check passes, GitHub requests a certificate from Let's Encrypt and installs it. The docs say that can take up to an hour after DNS is correct, and that the Enforce HTTPS control can take up to 24 hours to appear. Enable Enforce HTTPS after the check mark is shown beside the domain. The landing certificate lists both the apex and `www`; expect the same pair here. These zones had no `CAA` records. If one exists at edit time, include `letsencrypt.org` as an issue authority and keep the other CAA values.

If the setting remains "Certificate not yet created" after `dig` shows only the GitHub addresses, remove the custom domain and save the same apex again. That restarts provisioning.

10. Check the finished site.

- Opening `https://trainingdatascoutco.com/` and `https://www.trainingdatascoutco.com/`, including a path or query string, ends at `https://trainingdatascout.com/` with the existing landing page in the address bar.
- `curl -sI https://trainingdatascoutco.com/` shows `200` from `GitHub.com` and no `Location` header. The landing hop is inside the HTML.
- `curl -sI https://www.trainingdatascoutco.com/` may show GitHub's companion-host redirect to `https://trainingdatascoutco.com/`. On the live landing site, `https://www.trainingdatascout.com/` returns `301` to `https://trainingdatascout.com/`, and `http://trainingdatascout.com/` returns `301` to `https://trainingdatascout.com/` because Enforce HTTPS is on. Those are GitHub's host and scheme redirects. They stay on the warming name until the HTML runs.
- `www` then apex then the fixed landing URL is two hops and stops. The landing site does not point back. A query or path cannot change the destination, because the HTML contains only that absolute URL.

```sh
python3 redirect-kits/tests/test_redirects.py --dns-post
```

11. After those checks pass, the Mailpool captcha host is no longer on the path. Clearing the saved Mailpool redirect is cleanup. Leave the domain, the `MX` record, and the mail `TXT` records in workspace 6638.

## Rollback of the web records

Restore the apex `A` and the `www` `A` to the address in the table for that zone, and remove the GitHub `A`, `AAAA`, and `www` `CNAME` records. Leave `MX`, SPF, DKIM, DMARC, `google-site-verification`, the verification `TXT`, and the nameservers in place. The previous TTL of 5 seconds is why a bad web edit ages out quickly; the new records use 300 seconds, so allow that long after a rollback.

## Local check

```sh
python3 redirect-kits/tests/test_redirects.py
python3 redirect-kits/tests/test_redirects.py --dns-pre
```

The default command checks the four kits and opens them in headless Chrome, including a path, a query string, and script disabled. `--dns-pre` checks that apex and `www` still use the Mailpool addresses in the table. `--dns-post` is the acceptance check and fails until the cutover is done.

Claude Code CLI was not installed in the environment that prepared these files (`claude` was absent from `PATH`). The kits and tests were written and run directly.
