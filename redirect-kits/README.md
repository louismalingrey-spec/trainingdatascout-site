# Warming-domain redirect kits

These folders are the roots of four new GitHub Pages repositories. They send `trainingdatascoutco.com`, `trainingdatascoutfirm.com`, `trainingdatascoutgroup.com`, and `trainingdatascoutpartners.com` to `https://trainingdatascout.com/` with a browser redirect.

Nothing in this directory is deployed. The landing repository custom domain stays `trainingdatascout.com`. Publishing source for that site is the root of `main`, so merging this branch would also publish `/redirect-kits/` on the landing host. Copy each domain folder into its own new repository instead. The procedure, DNS values, and certificate order are in `RUNBOOK.md`.

```sh
python3 redirect-kits/tests/test_redirects.py
```
