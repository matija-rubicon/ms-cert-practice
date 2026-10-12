# Question review flags

Generated from `scripts/overrides/<exam>.json` after the full-bank formatting review.
Answer keys were **not** changed by the review; these are for a human to check.

## AZ400

### Disabled (22) — hidden from quizzes

- **q74** — Question image (word-image-153.png) shows the IT Service Management Connector Azure page, not the pipeline execution result; stage count cannot be determined from the question.
- **q92** — Question asks about "contosoapp2" but the attached exhibit is a Project1/Project2/Project3 table; the data the question depends on is missing.
- **q97** — Both images in the question (word-image-164 and -165) are the same Project1/Project2/Project3 table, not the release pipeline and task exhibits the question refers to; question cannot be answered.
- **q100** — Question asks about "TeamA" but the exhibit shows an App1/App2 deployment-requirements table; the TeamA requirements are missing.
- **q338** — Question depends on a distribution-group table, but the attached image shows an unrelated table/query (wrong exhibit).
- **q339** — Refers to "the following" distribution groups table (Group2) but no table or image is present.
- **q340** — Question depends on a distribution-group table, but the attached image shows an unrelated table/query (wrong exhibit).
- **q353** — Depends on an Application Insights log query exhibit, but the attached image is an unrelated Agile process diagram.
- **q363** — Case study is only an external Google Docs link; the Register-AzureRmAutomationDscNode command is not shown in the question.
- **q545** — Refers to an external case study (Google Docs link) whose content is not included; the question cannot be answered without it.
- **q577** — Question depends on a table of per-team source control requirements, but the image shows an unrelated DevSecOps diagram.
- **q664** — Refers to Slot2 of an Azure CLI command that is not shown (no code/image); options and explanation do not match the question.
- **q675** — Asks which value goes into Slot1 of the OnCreate() starting code, but the code is not shown (no image or code block).
- **q676** — Asks which value goes into Slot2 of the OnCreate() starting code, but the code is not shown (no image or code block).
- **q679** — Refers to an incomplete Dockerfile (Slot2) that is not shown anywhere in the question.
- **q680** — Refers to an incomplete Dockerfile (Slot3) that is not shown anywhere in the question.
- **q681** — Refers to an incomplete Dockerfile (Slot4) that is not shown anywhere in the question.
- **q687** — Refers to 'the following command' with Slot 1, but the command is not shown (no code or image).
- **q701** — Refers to 'the team leads' of a case study that is not included; no requirements are given to choose a feed permission.
- **q709** — Refers to 'the following release pipeline' with numbered sections (1)-(4), but the pipeline screenshot is not included.
- **q710** — Refers to 'the following release pipeline' with numbered sections (1)-(4), but the pipeline screenshot is not included.
- **q712** — Refers to an incomplete Dockerfile (Slot1) that is not shown anywhere in the question.

### Flagged (64)

- **q7** — Answer key may be wrong: restricting WhiteSource Bolt to production dependencies normally needs 'npm install --production' (or --only=prod); plain 'npm install' also installs devDependencies.
- **q10** — Exhibit offers Azure Key Vault as a storage location, but the options only list Azure Storage with HTTP/HTTPS; the key may be questionable. Question is still answerable.
- **q55** — Options 1 and 3 are identical (Get-AzPolicyRemediation); likely one was meant to be a different cmdlet (e.g. Get-AzPolicyEvent / Start-AzPolicyComplianceScan).
- **q99** — Answer key says Azure Test Plans for "store logs from automated tests", but q96 (same asset list) keys Azure Pipelines; likely inconsistent, verify.
- **q112** — Explanation says "set up a service hook" but the correct answer and following text describe a service connection; explanation wording inconsistent.
- **q116** — Explanation has unrelated trailing text/image about Azure Boards process selection (copied from another question); left untouched because wording cannot be changed.
- **q122** — Case study has a duplicated near-identical bullet about App Center reporting; left as is.
- **q124** — Case study has a duplicated near-identical bullet about App Center reporting; left as is.
- **q127** — Explanation says "Option A is incorrect" twice; second should be Option D. Wording left unchanged.
- **q128** — Key (A, C, D) includes Windows Server 2019 container images in ACR, which contradicts q98 explanation (Defender does not support Windows images in ACR); verify key.
- **q189** — Explanation starts with "nswer – C" (truncated "Answer") - left as scraped; not a wording change allowed.
- **q190** — Option B text contains typo "sectionc" (kept as-is to preserve wording).
- **q194** — Question asks for 2 ways; option C (post-deployment gate after QA) vs D (pre-deployment gate before production) - answer key C and D taken from source; option C is questionable since the requirement is to process a change request before production release.
- **q303** — Explanation says "Answer – D" (Stakeholder) but the key marks A (Basic) correct and the explanation text itself says Basic; the letter in the explanation is wrong.
- **q365** — Question refers to an external case study (Google Docs link) that is not included; the question itself is answerable from its options.
- **q492** — Explanation ends with scraped junk "Ask our Experts" (left in place to keep visible text unchanged).
- **q513** — Explanation says "service hook" but the correct option is "A service connection" (explanation text inconsistent with the key; key itself looks right).
- **q514** — Image shows Task1..Task4 and the key (D, VSBuild Task) matches Task2 given q515 (Task3=Analyze) and q516 (Task4=Publish) with Task1=Prepare; but the explanation text claims VSBuild is "Task1" and that Prepare is not first, which contradicts the key/series. Explanation needs a human rewrite.
- **q531** — Case study not included, but the question is answerable from the image (AppCenter.Start typeof slots).
- **q547** — Refers to an external case study via Google Docs link; question is answerable from the options alone.
- **q550** — Suspected wrong answer key: self-hosted agents register in the Default pool by default, so the original exam answer for this solution is Yes; the explanation claiming Default contains only Microsoft-hosted agents is inaccurate.
- **q566** — Answer key (make the NuGet repository public) is questionable versus q593 (use views to promote); verify.
- **q567** — Inconsistent with q614 (same solution marked Yes there); verify the key.
- **q586** — Inconsistent with q614 (same solution marked Yes there); verify the key.
- **q594** — Suspected wrong answer key: the Aggregation granularity (Period) for an average over five minutes is normally 5 minutes (1 minute is the evaluation frequency).
- **q598** — Question is vague (no scenario) and offers only two options; answer key may be debatable.
- **q614** — Inconsistent with q567/q586, which mark "increase test coverage" as No for the same goal; verify the key.
- **q616** — Scrape left an empty 'correct' option before the real one; removed it and marked the following option correct (matches explanation).
- **q617** — Suspected wrong answer key: ubuntu-16.04 is Linux and cannot provide the full .NET Framework; the expected answers are Windows images (e.g. vs2017-win2016, win1803).
- **q619** — Suspected wrong answer key: contradicts q584 (same question, key says project-level service connection). Service connections are created at project level.
- **q631** — Option 4 is a stray URL, not a real answer choice (scraping artifact).
- **q634** — The underlined segment ("build pipelines") lost its underline formatting in scraping.
- **q635** — First option "Choose the correct answer" is a scraping artifact, not a real choice.
- **q667** — Suspected wrong answer key: Project Collection Administrators is not least privilege; creating queries/shared queries is normally granted via Contributors (or Project Administrators for shared queries), so the key looks questionable.
- **q690** — Suspected wrong answer key: screenshot shows two jobs (a 'Build' job in the Build stage and a 'Deploy' job in the Deploy stage), key says 1.
- **q704** — Explanation describes Availability Zones for app1, contradicting the answer key (Virtual Machine Scale Sets); the key looks right, explanation seems swapped with q705.
- **q705** — Explanation describes Virtual Machine Scale Sets for app2, contradicting the answer key (Availability Zones); the key looks right, explanation seems swapped with q704.
- **q711** — Question refers to a release pipeline screenshot that is not included, but the answer (Retention) does not depend on it.
- **q721** — Option E 'Create a service hook in Azure DevOp' is truncated in the source text (cosmetic); answer key looks consistent.
- **q728** — Explanation discusses Microsoft-hosted agents while the question requires a self-hosted agent; answer key (Azure Container Instances) is plausible but explanation does not match.
- **q738** — Explanation refers to "the previous list" of permissions that is not included in the question.
- **q750** — Explanation says the Microsoft documentation mentions the following, but the quoted content is missing.
- **q755** — Question asks for the access level for the developers, but the key marks Stakeholder (the explanation is the same as for the test-user variant); developers would normally need Basic. Suspected wrong answer key.
- **q764** — Option F (empty text) is marked correct while "E. What should we try next?" is marked incorrect; explanation says went well / could have gone better / try next are the three answers. Answer key/options are corrupted. / Scrape left an empty 'correct' option before the real one; removed it and marked the following option correct (matches explanation).
- **q778** — Explanation lists tenant ID, subscription ID and service principal ID/key as inputs; verify whether "the client secret" should also be correct (it is marked incorrect) and why the explanation references answers A, B and D.
- **q789** — Suspected wrong key: full .NET Framework apps require Windows container hosts, but ubuntu-16.04 (Linux) is marked correct; vs2017-win2016 (marked incorrect) seems more plausible alongside win1803.
- **q802** — Same scenario as q793, where Rebase is the key (it is the option that rewrites history); here Merge is marked correct and no Rebase option exists. Suspected wrong answer key / conflicting questions.
- **q803** — Explanation describes canary deployment, which is marked incorrect; key is Red/Black deployment. Explanation does not support the key.
- **q820** — Explanation link is to upstream sources docs, not views; key "views" appears correct per Azure Artifacts docs.
- **q830** — Pre-deployment approval Timeout can be extended up to 365 days, so "No" key is questionable.
- **q839** — Explanation says Cobertura cannot integrate with Azure DevOps, contradicting the key marking it correct (Publish Code Coverage Results supports Cobertura and JaCoCo).
- **q846** — Suspected wrong key: explanation says analysis is based on Log Analytics language, which suggests "Yes".
- **q854** — Explanation references a whitepaper excerpt that is not included.
- **q856** — Explanation is just "1" (junk).
- **q857** — Explanation is just "3" (junk).
- **q858** — Source only had the 'False' option; restored the missing 'True' option.
- **q859** — Source only had the 'False' option; restored the missing 'True' option.
- **q860** — Statement and instruction were scraped into the options; moved back into the question (manual repair).
- **q875** — Statement and instruction were scraped into the options; moved back into the question (manual repair).
- **q891** — Suspected wrong key / explanation mismatch: question is about a Docker-based IIS app (Hosted Windows Container expected), explanation talks about the generic Hosted pool.
- **q892** — Suspected wrong key: check-in policies are TFVC-only and do not apply to Git pull requests (build policy is the right answer, see q893).
- **q897** — Questionable answer: "Impediment" is not a standard expedite work item type; looks LLM-generated.
- **q899** — Options carry "A."/"B." prefixes in text; left unchanged to preserve wording.
- **q906** — Options carry letter prefixes; option D had a stray code flag, cleared.

## AZ104

### Disabled (1) — hidden from quizzes

- **q286** — Refers to group table, user table and license assignment exhibit that are not present in the question (no images).

### Flagged (23)

- **q31** — Option 2 text is garbled ('A,, B, C' - stray comma); left unchanged to avoid altering option text. Likely meant 'A, B, C'.
- **q45** — Explanation refers to non-existent 'image_862960.png' (scrape artifact); left unchanged.
- **q55** — Explanation reads 'The  is ...' (word 'answer' missing in source) and uses a stray ‘ as apostrophe; left unchanged.
- **q56** — Explanation reads 'The  is ...' (word missing in source) and uses a stray ‘ as apostrophe; left unchanged.
- **q57** — Explanation/question use ‘ as apostrophe (encoding artifact); left unchanged.
- **q59** — Explanation reads 'The  is ...' (word missing in source) and uses a stray ‘ as apostrophe; left unchanged.
- **q61** — Question uses ‘ as apostrophe (encoding artifact); left unchanged.
- **q63** — Explanation uses “deny all“ with mismatched closing quote; left unchanged.
- **q65** — Question text is duplicated (first paragraph repeated after the image); left unchanged since wording must not change; still answerable.
- **q80** — Table lists LB1 SKU as Standard but the LB1 exhibit shows SKU: Basic (inconsistent); answer (Yes) is unaffected.
- **q84** — Suspected wrong answer key: VM1 running (2 vCPUs) + VM5 (16 vCPUs) = 18 <= 20 for both Standard BS family and total regional quota (VM20 is deallocated), so VM5 appears deployable (TRUE); the explanation itself computes 18 <= 20 before contradicting itself.
- **q91** — Explanation contains a stray LaTeX fragment ($\checkmark$).
- **q103** — Option D label is inaccurate: physical_data_read_percent / xtp_storage_percent are not memory-usage metrics; key may be questionable.
- **q114** — Both Application Gateway with WAF and Front Door with WAF are valid WAF integrations for App Service; key may be debatable.
- **q165** — Explanation contains a markdown-style link inside inline code (www.contoso.com); left unchanged to keep text identical.
- **q175** — Explanation says Disabled is not a valid effect/enforcement mode, but Disabled is a valid Azure Policy effect; key (Audit, Append, Deny) fine for the question as asked.
- **q182** — Answer key looks doubtful: option C pairs SMB 3.0 encryption (Azure Files) with a Blob/Storage scenario; HTTPS with CMK might be intended. Verify.
- **q195** — Options B, C and A all describe lifecycle management; the key (option A) rests on wording only. Verify.
- **q197** — Options B and C are both valid definitions of RPO/RTO; key is B. Verify.
- **q216** — Question text repeats the statement before and after the images; left as is to preserve wording.
- **q220** — Reader and Data Access role does allow listing and regenerating storage account keys (via listKeys/regenerateKey actions), so the key "No" may be wrong. Verify.
- **q243** — Explanation has missing word: "The  is IP Flow Verify" (likely "The answer is")
- **q252** — Explanation has missing word: "The  is Create separate..." (likely "The answer is")
