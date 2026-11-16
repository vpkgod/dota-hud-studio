"""Генерация CSS, проверка значений и безопасность входных данных."""
import unittest

from hudstudio import catalog, cssgen, values


class CatalogTest(unittest.TestCase):
    def test_ids_unique(self):
        ids = [c["id"] for g in catalog.groups() for c in g["controls"]]
        self.assertEqual(len(ids), len(set(ids)))

    def test_groups_follow_menu_order(self):
        areas = [area["id"] for area in catalog.AREAS]
        groups = catalog.groups()
        self.assertEqual([g["id"] for g in groups], catalog.GROUP_ORDER)
        self.assertEqual([areas.index(g["area"]) for g in groups], sorted(areas.index(g["area"]) for g in groups))

    def test_hints_and_game_only_point_to_real_settings(self):
        ids = set(catalog.controls())
        self.assertEqual(sorted(set(catalog.HINTS) - ids), [])
        self.assertEqual(sorted(catalog.GAME_ONLY - ids), [])
        self.assertTrue(all(c["sub"] for c in catalog.controls().values()))

    def test_defaults_are_valid(self):
        self.assertEqual(values.sanitize(catalog.defaults()), catalog.defaults())

    def test_required_features_present(self):
        ids = set(catalog.controls())
        for need in ("hp.fill", "hp.radius", "inv.bg", "inv.image", "shop.bg", "ab.size"):
            self.assertIn(need, ids)


class SanitizeTest(unittest.TestCase):
    def test_unknown_keys_dropped(self):
        self.assertNotIn("evil", values.sanitize({"evil": "x"}))

    def test_css_injection_in_color_is_rejected(self):
        clean = values.sanitize({"hp.label": "red; } * { visibility: collapse"})
        self.assertEqual(clean["hp.label"], catalog.defaults()["hp.label"])

    def test_number_is_clamped(self):
        control = catalog.controls()["hp.radius"]
        self.assertEqual(values.sanitize({"hp.radius": 99999})["hp.radius"], control["max"])

    def test_number_rejects_nan_and_bool(self):
        default = catalog.defaults()["hp.radius"]
        self.assertEqual(values.sanitize({"hp.radius": float("nan")})["hp.radius"], default)
        self.assertEqual(values.sanitize({"hp.radius": True})["hp.radius"], default)

    def test_image_id_must_be_hex(self):
        bad = {"id": "../../etc/passwd", "fit": "cover", "opacity": 1}
        self.assertIsNone(values.sanitize({"inv.bg": bad})["inv.bg"])

    def test_fill_needs_two_to_four_stops(self):
        default = catalog.defaults()["hp.fill"]
        one = {"dir": "v", "stops": [{"p": 0, "c": "#ffffff"}]}
        self.assertEqual(values.sanitize({"hp.fill": one})["hp.fill"], default)

    def test_sanitize_does_not_mutate_input(self):
        raw = {"hp.radius": 99999}
        values.sanitize(raw)
        self.assertEqual(raw, {"hp.radius": 99999})


class CssGenTest(unittest.TestCase):
    def test_defaults_generate_nothing(self):
        self.assertEqual(cssgen.generate(catalog.defaults()), {})

    def test_gradient_format_matches_game(self):
        fill = {"dir": "h", "stops": [{"p": 0, "c": "#ff0000"}, {"p": 0.5, "c": "#00ff00"}, {"p": 1, "c": "#0000ff"}]}
        self.assertEqual(
            cssgen.panorama_fill(fill),
            "gradient( linear, 0% 0%, 100% 0%, from( #ff0000 ), color-stop( 0.5, #00ff00 ), to( #0000ff ) )")

    def test_same_colored_stops_become_solid(self):
        fill = {"dir": "v", "stops": [{"p": 0, "c": "#123456"}, {"p": 1, "c": "#123456"}]}
        self.assertEqual(cssgen.panorama_fill(fill), "#123456")

    def test_hp_change_goes_to_health_file_only(self):
        fill = {"dir": "v", "stops": [{"p": 0, "c": "#ff0000"}, {"p": 1, "c": "#aa0000"}]}
        css = cssgen.generate({**catalog.defaults(), "hp.fill": fill})
        self.assertEqual(list(css), ["hud/dota_hud_health_mana.css"])
        self.assertIn(".Reborn #HealthProgress .ProgressBarLeft", css["hud/dota_hud_health_mana.css"])

    def test_radius_rounds_fill_and_only_outer_track_corners(self):
        css = cssgen.generate({**catalog.defaults(), "hp.radius": 12})["hud/dota_hud_health_mana.css"]
        self.assertIn("border-radius: 12px", css)
        self.assertIn("border-top-right-radius: 12px", css)
        self.assertIn("border-bottom-right-radius: 12px", css)

    def test_image_rule_uses_custom_path(self):
        image = {"id": "abcdef0123456789", "fit": "cover", "opacity": 0.5}
        css = cssgen.generate({**catalog.defaults(), "inv.bg": image})["hud/dota_hud_inventory.css"]
        self.assertIn('url("s2r://panorama/images/hudstudio/uabcdef0123456789.vtex")', css)
        self.assertIn("background-size: cover", css)
        self.assertIn("background-img-opacity: 0.5", css)

    def test_images_used(self):
        image = {"id": "abcdef0123456789", "fit": "cover", "opacity": 1}
        self.assertEqual(cssgen.images_used({**catalog.defaults(), "inv.bg": image}), {"abcdef0123456789"})

    def test_offset_is_one_transform(self):
        css = cssgen.generate({**catalog.defaults(), "inv.offset": {"x": 10, "y": -5}})["hud/hud_reborn.css"]
        self.assertIn("transform: translateX( 10px ) translateY( -5px )", css)

    def test_hide_toggle(self):
        css = cssgen.generate({**catalog.defaults(), "minimap.show": False})["hud/hud_reborn.css"]
        self.assertIn("visibility: collapse", css)

    def test_percent_control_divides(self):
        css = cssgen.generate({**catalog.defaults(), "fx.sat": 150})["hud/hud_reborn.css"]
        self.assertIn("saturation: 1.5", css)

    def test_ability_size_also_sets_autocast(self):
        css = cssgen.generate({**catalog.defaults(), "ab.size": 80})["hud/dota_hud_ability_panel.css"]
        self.assertIn("width: 80px", css)
        self.assertIn("width: 74px", css)


class NewFeaturesTest(unittest.TestCase):
    IMAGE = {"id": "abcdef0123456789", "fit": "stretch", "opacity": 1}
    TINT = {"fill": {"dir": "v", "stops": [{"p": 0, "c": "#ff0000"}, {"p": 1, "c": "#0000ff"}]},
            "mode": "keep", "strength": 100, "bright": 0}

    def test_tint_survives_cleaning(self):
        raw = {**self.IMAGE, "fit": "original", "tint": self.TINT, "base": None}
        self.assertEqual(values.sanitize({"por.left": raw})["por.left"], raw)

    def test_bad_tint_is_dropped(self):
        raw = {**self.IMAGE, "tint": {**self.TINT, "mode": "взлом"}, "base": "../etc"}
        self.assertEqual(values.sanitize({"por.left": raw})["por.left"], self.IMAGE)

    def test_recolored_original_keeps_game_layout(self):
        css = self.css(por__left={**self.IMAGE, "fit": "original"})["hud/hud_reborn.css"]
        self.assertIn("hudstudio/uabcdef0123456789.vtex", css)
        self.assertNotIn("background-size", css)

    def test_base_image_is_not_packed(self):
        changed = {**catalog.defaults(), "por.left": {**self.IMAGE, "tint": self.TINT, "base": "1111111111111111"}}
        self.assertEqual(cssgen.images_used(changed), {self.IMAGE["id"]})

    def css(self, **changes):
        values_ = {**catalog.defaults(), **{k.replace("__", "."): v for k, v in changes.items()}}
        return cssgen.generate(values_)

    def test_outline_uses_game_format(self):
        css = self.css(hp__labelOutline={"on": True, "c": "#112233", "w": 3})["hud/dota_hud_health_mana.css"]
        self.assertIn("text-shadow: 0px 0px 3px 4.2 #112233", css)

    def test_outline_switched_off_writes_nothing(self):
        self.assertEqual(self.css(hp__labelOutline={"on": False, "c": "#112233", "w": 3}), {})

    def test_glow_uses_game_format(self):
        css = self.css(hp__glow={"on": True, "c": "#ff0000", "w": 2})["hud/dota_hud_health_mana.css"]
        self.assertIn("box-shadow: #ff0000 0px 0px 4px 2px", css)

    def test_bad_outline_falls_back(self):
        clean = values.sanitize({"hp.labelOutline": {"on": "да", "c": "#000000", "w": 2}})
        self.assertEqual(clean["hp.labelOutline"], catalog.defaults()["hp.labelOutline"])

    def test_minimap_size_beats_large_minimap_setting(self):
        css = self.css(minimap__size=338)["hud/hud_reborn.css"]
        for selector in ("#minimap_block", ".MinimapExtraLarge #minimap_block", ".MinimapExtraExtraLarge #minimap_block",
                         ".MinimapExtraLarge #minimap", ".MinimapExtraExtraLarge #GlyphScanContainer"):
            self.assertIn(f"{selector}\n{{", css)
        self.assertIn("width: 354px", css)

    def test_quick_buy_moves_on_its_own(self):
        css = self.css(quick__offset={"x": -40, "y": -20})["hud/dota_hud_quick_buy.css"]
        self.assertIn("#QuickBuyRows", css)
        self.assertIn("translateX( -40px ) translateY( -20px )", css)

    def test_shop_background_targets_real_panel(self):
        css = self.css(shop__bg=self.IMAGE)["hud/dota_hud_shop.css"]
        self.assertIn("#HeightLimiterContainer", css)
        self.assertNotIn("#MainShop", css)

    def test_whole_shop_image_clears_covering_panels(self):
        css = self.css(shop__bgAll=self.IMAGE)["hud/dota_hud_shop.css"]
        self.assertIn("#Main\n{", css)
        self.assertIn("#SearchAndButtonsContainer\n{\n\tbackground-color: none", css)

    def test_innate_icon_replaces_game_texture(self):
        changed = {**catalog.defaults(), "innate.icon": self.IMAGE}
        self.assertEqual(cssgen.generate(changed), {})
        self.assertEqual(cssgen.images_used(changed), set())
        self.assertEqual(cssgen.replaced_textures(changed), {
            "panorama/images/hud/facets/innate_icon_png": self.IMAGE["id"],
            "panorama/images/hud/facets/innate_icon_large_png": self.IMAGE["id"],
        })

    def test_team_bar_color_removes_game_texture(self):
        css = self.css(top__hpRadiant="#00ff00")["hud/dota_hud_top_bar.css"]
        self.assertIn("background-color: #00ff00", css)
        self.assertIn("background-image: none", css)


if __name__ == "__main__":
    unittest.main()
