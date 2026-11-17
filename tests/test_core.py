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


class BottomPanelAnchorTest(unittest.TestCase):
    """Ширина нижней панели зависит от героя: блок за серединой привязываем к другому краю."""

    def test_portrait_moved_right_sticks_to_right_edge(self):
        css = cssgen.generate({"por.offset": {"x": 605, "y": 3}})["hud/hud_reborn.css"]
        self.assertIn("#PortraitGroup,#stats_container", css)
        self.assertIn("horizontal-align: right", css)
        self.assertIn("margin-right: 124px", css)  # 940 - (52 + 605) - 159
        self.assertIn("translateX( 0px ) translateY( 3px )", css)

    def test_small_move_keeps_own_edge(self):
        css = cssgen.generate({"por.offset": {"x": 100, "y": 0}})["hud/hud_reborn.css"]
        self.assertNotIn("horizontal-align", css)
        self.assertIn("translateX( 100px )", css)

    def test_inventory_moved_left_sticks_to_left_edge(self):
        css = cssgen.generate({"inv.offset": {"x": -600, "y": 0}})["hud/hud_reborn.css"]
        self.assertIn("horizontal-align: left", css)
        self.assertIn("margin-left: 45px", css)  # 940 - (93 + 600) - 202



class FollowersTest(unittest.TestCase):
    def test_talent_hint_follows_abilities_and_talent_button(self):
        css = cssgen.generate({"ab.offset": {"x": -158, "y": 8}, "talent.offset": {"x": 10, "y": 0}})["hud/hud_reborn.css"]
        self.assertIn("#level_stats_frame,#StatBranchHotkey\n{\n\ttransform: translateX( -148px ) translateY( 8px );\n}", css)

    def test_inventory_color_under_background(self):
        css = cssgen.generate({"inv.bgColor": "#22111100"})["hud/dota_hud_inventory.css"]
        self.assertIn(".Reborn #inventory_items\n{\n\tbackground-color: #22111100;\n}", css)


class PortraitFollowersTest(unittest.TestCase):
    """Имя героя и значок тира — отдельные панели игры: едут за портретом."""

    def test_small_move_shifts_name_and_badge(self):
        css = cssgen.generate({"por.offset": {"x": 40, "y": -5}})["hud/hud_reborn.css"]
        for sel in ("#unitname", "#PortraitHeroBadgeOverlay", "#PortraitHeroBadge"):
            self.assertIn(f"{sel}\n{{\n\ttransform: translateX( 40px ) translateY( -5px );\n}}", css)

    def test_name_sticks_to_right_edge_with_portrait(self):
        css = cssgen.generate({"por.offset": {"x": 605, "y": 0}})["hud/hud_reborn.css"]
        self.assertIn("#unitname\n{\n\thorizontal-align: right;\n\tmargin-left: 0px;\n\tmargin-right: 124px;", css)

    def test_scale_alone_moves_followers(self):
        css = cssgen.generate({"por.scale": 80})["hud/hud_reborn.css"]
        self.assertIn("#unitname\n{\n\tui-scale: 80%;\n\ttransform: translateX( 15.9px ) translateY( 29px );", css)


class RoundSlotsTest(unittest.TestCase):
    """Слой круглых слотов игра не рисует, если на нём transform или у родителя overflow: noclip."""

    def test_round_slots_move_with_margins_only(self):
        css = cssgen.generate({"round.offset": {"x": -52.5, "y": 4}})["hud/hud_reborn.css"]
        rule = css[css.index("#inventory_composition_layer_container"):]
        rule = rule[:rule.index("}")]
        self.assertNotIn("transform", rule)
        self.assertIn("margin-right: 70.5px", rule)
        self.assertIn("margin-bottom: -4px", rule)

    def test_no_noclip_anywhere(self):
        css = cssgen.generate({"inv.offset": {"x": -600, "y": 0}, "por.offset": {"x": 600, "y": 0}})["hud/hud_reborn.css"]
        self.assertNotIn("noclip", css)
