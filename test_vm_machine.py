"""Checks the machine's decisions on the bundle items the panel will ask about.

    GLUCORA_BUNDLE=<bundle_dir> python -m unittest -v
"""
import os
import unittest

import vm_machine

BUNDLE = os.environ.get("GLUCORA_BUNDLE")


@unittest.skipUnless(BUNDLE, "set GLUCORA_BUNDLE to the bundle folder")
class TestOnBundle(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.r = vm_machine.run(BUNDLE)
        cls.u = {u["unit_id"]: u for u in cls.r["units"]}

    def test_input_matches_process_snapshot(self):
        self.assertEqual(self.r["input"]["open_findings"], 4902)

    def test_collapse(self):
        # 4,902 findings must become far fewer units; the point of the machine.
        self.assertLess(len(self.r["units"]), 150)

    def test_scaffold_vintage_is_one_platform_campaign(self):
        u = self.u["scaffold:lovable-scaffold-2025.03"]
        self.assertEqual(u["verb"], "campaign")
        self.assertEqual(len(u["projects"]), 11)
        self.assertTrue(u["owner"].startswith("platform"))

    def test_kev_jose_breaks_out_across_projects(self):
        u = self.u["exploited-cve:CVE-2026-916242"]
        self.assertEqual(u["verb"], "act-now")
        self.assertEqual(len(u["projects"]), 5)

    def test_react_router_major_bump_needs_review_and_is_not_split(self):
        u = self.u["exploited-cve:CVE-2026-916275"]
        self.assertTrue(u["needs_review"])
        self.assertEqual(u["live_findings"], 9)  # all runtime instances, incl. internal hr-portal

    def test_human_pattern_joins_unit(self):
        u = self.u["bug-class:PT-2026-07"]
        self.assertEqual(u["verb"], "act-now")
        self.assertIn("caregiver-app", u["projects"])  # BB-4501, "same pattern"

    def test_reporter_severity_without_exploit_closes(self):
        self.assertEqual(self.u["bug-class:BB-4533"]["verb"], "close")

    def test_dangling_cname_confirmed(self):
        self.assertEqual(self.u["bug-class:BB-4530"]["verb"], "act-now")

    def test_merged_is_not_fixed(self):
        self.assertEqual(self.r["input"]["validation"].get("fix merged but not published: not live"), 5)

    def test_dev_only_is_tracked(self):
        self.assertEqual(self.u["package:npm:@types/node"]["verb"], "track")

    def test_firmware(self):
        self.assertEqual(self.u["firmware:crypto-lib"]["verb"], "act-now")
        self.assertEqual(self.u["firmware:ble-host"]["devices_exposed"], 147400)
        self.assertEqual(self.u["firmware:bootloader"]["verb"], "track")


if __name__ == "__main__":
    unittest.main()
