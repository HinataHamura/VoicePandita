from __future__ import annotations

from manim import (
    BLUE,
    DOWN,
    FadeIn,
    FadeOut,
    GrowArrow,
    LEFT,
    Line,
    ORIGIN,
    RIGHT,
    Scene,
    Text,
    UP,
    VGroup,
    WHITE,
    Arrow,
    Circle,
    Dot,
    RoundedRectangle,
    Square,
    SurroundingRectangle,
    Transform,
    Write,
    Create,
)

INK = "#1E293B"
MUTED = "#64748B"
PAPER = "#F8FAFC"
FOREST = "#16A34A"
INDIGO = "#6366F1"
AQUA = "#06B6D4"
SAFFRON = "#F59E0B"
CLAY = "#F97316"
ROSE = "#EF4444"


def text(value: str, size: int = 34, color: str = INK, weight: str = "MEDIUM") -> Text:
    return Text(value, font_size=size, color=color, weight=weight)


def pill(value: str, color: str = INDIGO) -> VGroup:
    label = text(value, 22, color, "BOLD")
    bg = RoundedRectangle(
        corner_radius=0.18,
        width=label.width + 0.45,
        height=0.44,
        stroke_width=0,
        fill_color=color,
        fill_opacity=0.12,
    )
    return VGroup(bg, label).arrange(ORIGIN).move_to(bg)


def card(width: float, height: float, fill: str = WHITE, stroke: str = "#CBD5E1") -> RoundedRectangle:
    return RoundedRectangle(
        corner_radius=0.2,
        width=width,
        height=height,
        stroke_color=stroke,
        stroke_width=1.2,
        fill_color=fill,
        fill_opacity=0.92,
    )


def formula_card(value: str, accent: str = INDIGO, width: float = 6.8) -> VGroup:
    body = card(width, 1.0, WHITE, accent)
    stripe = RoundedRectangle(
        corner_radius=0.16,
        width=0.14,
        height=0.72,
        stroke_width=0,
        fill_color=accent,
        fill_opacity=1,
    ).align_to(body, LEFT).shift(RIGHT * 0.18)
    label = text(value, 38, INK, "BOLD").move_to(body.get_center()).shift(RIGHT * 0.08)
    return VGroup(body, stripe, label)


def step_card(title: str, detail: str, color: str, width: float = 4.1) -> VGroup:
    body = card(width, 1.1, WHITE, color)
    dot = Circle(radius=0.13, stroke_width=0, fill_color=color, fill_opacity=1).shift(LEFT * (width / 2 - 0.36))
    heading = text(title, 22, color, "BOLD")
    sub = text(detail, 18, MUTED)
    copy = VGroup(heading, sub).arrange(DOWN, aligned_edge=LEFT, buff=0.1).next_to(dot, RIGHT, buff=0.22)
    return VGroup(body, dot, copy).move_to(body)


class VoicePanditaScene(Scene):
    def setup(self) -> None:
        self.camera.background_color = PAPER

    def add_backdrop(self) -> None:
        lines = VGroup()
        for x in [i * 0.8 - 6.4 for i in range(17)]:
            lines.add(Line([x, -3.8, 0], [x, 3.8, 0], stroke_color="#E2E8F0", stroke_width=0.5))
        for y in [i * 0.8 - 3.2 for i in range(9)]:
            lines.add(Line([-7.2, y, 0], [7.2, y, 0], stroke_color="#E2E8F0", stroke_width=0.5))
        glow_left = Circle(radius=2.2, stroke_width=0, fill_color=AQUA, fill_opacity=0.07).shift(LEFT * 4.8 + UP * 2.4)
        glow_right = Circle(radius=2.5, stroke_width=0, fill_color=INDIGO, fill_opacity=0.06).shift(RIGHT * 4.8 + DOWN * 2.2)
        self.add(lines, glow_left, glow_right)

    def title_bar(self, title: str, subtitle: str) -> VGroup:
        mark = RoundedRectangle(corner_radius=0.16, width=0.62, height=0.62, stroke_width=0, fill_color=INDIGO, fill_opacity=1)
        mark_text = text("V", 28, WHITE, "BOLD").move_to(mark)
        brand = text("VoicePandita", 22, INK, "BOLD")
        topic = text(title, 34, INK, "BOLD")
        sub = text(subtitle, 18, MUTED)
        left = VGroup(VGroup(mark, mark_text), brand).arrange(RIGHT, buff=0.18)
        right = VGroup(topic, sub).arrange(DOWN, aligned_edge=RIGHT, buff=0.06)
        group = VGroup(left, right).arrange(RIGHT, buff=3.0).to_edge(UP, buff=0.28)
        rule = Line(LEFT * 6.5, RIGHT * 6.5, stroke_color="#CBD5E1", stroke_width=1).next_to(group, DOWN, buff=0.2)
        return VGroup(group, rule)

    def reveal_header(self, title: str, subtitle: str) -> None:
        header = self.title_bar(title, subtitle)
        self.play(FadeIn(header[0][0], shift=RIGHT * 0.15), Write(header[0][1]), Create(header[1]), run_time=0.8)


class NewtonSecondLawScene(VoicePanditaScene):
    def construct(self) -> None:
        self.add_backdrop()
        self.reveal_header("Newton's Second Law", "Force changes motion")

        formula = formula_card("F = m x a", SAFFRON, 4.7).shift(UP * 1.55)
        self.play(FadeIn(formula, shift=DOWN * 0.2), run_time=0.7)

        track = Line(LEFT * 4.7 + DOWN * 1.25, RIGHT * 4.7 + DOWN * 1.25, stroke_color="#94A3B8", stroke_width=4)
        cart = Square(side_length=1.05, stroke_color=INDIGO, stroke_width=3, fill_color=INDIGO, fill_opacity=0.16)
        cart.shift(LEFT * 2.5 + DOWN * 0.72)
        wheel_a = Circle(radius=0.13, stroke_color=INK, fill_color=WHITE, fill_opacity=1).next_to(cart, DOWN, buff=-0.02).shift(LEFT * 0.32)
        wheel_b = Circle(radius=0.13, stroke_color=INK, fill_color=WHITE, fill_opacity=1).next_to(cart, DOWN, buff=-0.02).shift(RIGHT * 0.32)
        cart_group = VGroup(cart, wheel_a, wheel_b)

        force = Arrow(cart.get_left() + LEFT * 1.5, cart.get_left() + LEFT * 0.05, color=CLAY, stroke_width=7, buff=0)
        accel = Arrow(cart.get_right() + RIGHT * 0.05, cart.get_right() + RIGHT * 1.45, color=FOREST, stroke_width=7, buff=0)
        mass_tag = pill("mass m", INDIGO).next_to(cart_group, UP, buff=0.24)
        force_tag = pill("force F", CLAY).next_to(force, UP, buff=0.18)
        accel_tag = pill("acceleration a", FOREST).next_to(accel, UP, buff=0.18)

        self.play(Create(track), FadeIn(cart_group, shift=UP * 0.2), FadeIn(mass_tag), run_time=0.8)
        self.play(GrowArrow(force), FadeIn(force_tag), run_time=0.65)
        self.play(cart_group.animate.shift(RIGHT * 1.7), mass_tag.animate.shift(RIGHT * 1.7), GrowArrow(accel), FadeIn(accel_tag), run_time=1.05)

        cards = VGroup(
            step_card("More force", "more acceleration", CLAY, 3.4),
            step_card("More mass", "needs more force", INDIGO, 3.4),
            step_card("Same units", "N = kg m/s^2", FOREST, 3.4),
        ).arrange(RIGHT, buff=0.28).to_edge(DOWN, buff=0.45)
        self.play(FadeIn(cards, shift=UP * 0.25), run_time=0.9)
        self.play(formula.animate.scale(1.06), run_time=0.35)
        self.play(formula.animate.scale(1 / 1.06), run_time=0.35)
        self.wait(1.1)


class QuadraticFormulaScene(VoicePanditaScene):
    def construct(self) -> None:
        self.add_backdrop()
        self.reveal_header("Quadratic Formula", "A repeatable solving path")

        standard = formula_card("ax^2 + bx + c = 0", INDIGO, 5.8).shift(UP * 1.62)
        self.play(FadeIn(standard, shift=DOWN * 0.2), run_time=0.7)

        steps = VGroup(
            step_card("1. Identify", "a, b, c", INDIGO, 3.2),
            step_card("2. Discriminant", "D = b^2 - 4ac", SAFFRON, 3.5),
            step_card("3. Solve", "x = (-b +/- sqrt(D)) / 2a", FOREST, 4.5),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.28).shift(LEFT * 3.0 + DOWN * 0.55)

        example = card(4.55, 3.1, WHITE, "#CBD5E1").shift(RIGHT * 2.65 + DOWN * 0.5)
        example_title = text("Example layout", 24, INK, "BOLD").move_to(example.get_top() + DOWN * 0.42)
        line_1 = text("2x^2 + 5x - 3 = 0", 25, INDIGO, "BOLD").next_to(example_title, DOWN, buff=0.35)
        line_2 = text("a = 2, b = 5, c = -3", 22, MUTED).next_to(line_1, DOWN, buff=0.28)
        line_3 = text("D = 25 + 24 = 49", 23, SAFFRON, "BOLD").next_to(line_2, DOWN, buff=0.28)
        line_4 = text("x = 1/2 or -3", 24, FOREST, "BOLD").next_to(line_3, DOWN, buff=0.28)
        example_group = VGroup(example, example_title, line_1, line_2, line_3, line_4)

        self.play(FadeIn(steps[0], shift=RIGHT * 0.2), run_time=0.5)
        self.play(FadeIn(steps[1], shift=RIGHT * 0.2), run_time=0.5)
        self.play(FadeIn(steps[2], shift=RIGHT * 0.2), run_time=0.5)
        self.play(FadeIn(example_group, shift=LEFT * 0.25), run_time=0.75)

        focus = SurroundingRectangle(line_3, color=SAFFRON, buff=0.12, corner_radius=0.08)
        self.play(Create(focus), run_time=0.5)
        self.play(Transform(focus, SurroundingRectangle(line_4, color=FOREST, buff=0.12, corner_radius=0.08)), run_time=0.65)
        self.play(FadeOut(focus), run_time=0.3)
        self.wait(1.1)


class PhotosynthesisScene(VoicePanditaScene):
    def construct(self) -> None:
        self.add_backdrop()
        self.reveal_header("Photosynthesis", "How plants make food")

        sun = Circle(radius=0.58, stroke_width=0, fill_color=SAFFRON, fill_opacity=0.92).shift(LEFT * 4.5 + UP * 1.15)
        sun_rays = VGroup(*[
            Line(ORIGIN, RIGHT * 0.35, stroke_color=SAFFRON, stroke_width=3).rotate(i * 0.785).move_to(sun.get_center() + RIGHT * 0.86).rotate(i * 0.785, about_point=sun.get_center())
            for i in range(8)
        ])
        leaf = VGroup(
            Circle(radius=0.86, stroke_color=FOREST, stroke_width=4, fill_color=FOREST, fill_opacity=0.18).scale([1.45, 0.62, 1]),
            Line(LEFT * 1.0, RIGHT * 1.0, stroke_color=FOREST, stroke_width=3),
        ).shift(DOWN * 0.15)
        chlorophyll = Dot(leaf.get_center(), radius=0.09, color=FOREST)

        inputs = VGroup(
            pill("CO2", BLUE).shift(LEFT * 4.4 + DOWN * 1.45),
            pill("H2O", AQUA).shift(RIGHT * 4.25 + DOWN * 1.45),
            pill("light", SAFFRON).next_to(sun, DOWN, buff=0.32),
        )
        outputs = VGroup(
            pill("glucose", FOREST).shift(RIGHT * 3.95 + UP * 0.85),
            pill("O2", CLAY).shift(RIGHT * 4.25 + DOWN * 0.12),
        )

        equation = formula_card("CO2 + H2O + light  ->  glucose + O2", FOREST, 8.0).to_edge(DOWN, buff=0.48)

        self.play(Create(sun), Create(sun_rays), run_time=0.75)
        self.play(Create(leaf), FadeIn(chlorophyll), run_time=0.75)
        self.play(FadeIn(inputs, shift=UP * 0.16), run_time=0.7)
        self.play(
            GrowArrow(Arrow(inputs[2].get_bottom(), leaf.get_top(), color=SAFFRON, stroke_width=5, buff=0.12)),
            GrowArrow(Arrow(inputs[0].get_right(), leaf.get_left(), color=BLUE, stroke_width=5, buff=0.12)),
            GrowArrow(Arrow(inputs[1].get_left(), leaf.get_right(), color=AQUA, stroke_width=5, buff=0.12)),
            run_time=1.1,
        )
        self.play(leaf.animate.scale(1.08), chlorophyll.animate.scale(1.5), run_time=0.35)
        self.play(leaf.animate.scale(1 / 1.08), chlorophyll.animate.scale(1 / 1.5), run_time=0.35)
        self.play(FadeIn(outputs, shift=LEFT * 0.18), FadeIn(equation, shift=UP * 0.2), run_time=0.9)
        self.wait(1.1)


SCENES = {
    "newton_second_law": NewtonSecondLawScene,
    "quadratic_formula": QuadraticFormulaScene,
    "photosynthesis": PhotosynthesisScene,
}
