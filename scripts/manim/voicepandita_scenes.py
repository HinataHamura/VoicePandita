from __future__ import annotations

from manim import (
    BLUE,
    GREEN,
    ORANGE,
    RED,
    WHITE,
    YELLOW,
    Arrow,
    Circle,
    Create,
    DOWN,
    FadeIn,
    FadeOut,
    LEFT,
    Line,
    ORIGIN,
    RIGHT,
    Scene,
    Square,
    Text,
    Transform,
    UP,
    VGroup,
    Write,
)


def label(text: str, size: int = 34, color=WHITE) -> Text:
    return Text(text, font_size=size, color=color)


class NewtonSecondLawScene(Scene):
    def construct(self) -> None:
        title = label("Newton's Second Law", 42, YELLOW).to_edge(UP)
        formula = label("F = m x a", 54, WHITE).next_to(title, DOWN, buff=0.5)
        cart = Square(side_length=1.0, color=BLUE).shift(LEFT * 2.2 + DOWN * 0.8)
        cart_label = label("mass m", 24).next_to(cart, DOWN)
        force_arrow = Arrow(cart.get_left() + LEFT * 1.4, cart.get_left(), color=ORANGE, buff=0)
        force_label = label("force F", 24, ORANGE).next_to(force_arrow, UP)
        accel_arrow = Arrow(cart.get_right(), cart.get_right() + RIGHT * 1.8, color=GREEN, buff=0)
        accel_label = label("acceleration a", 24, GREEN).next_to(accel_arrow, UP)

        self.play(Write(title), Write(formula))
        self.play(Create(cart), FadeIn(cart_label))
        self.play(Create(force_arrow), FadeIn(force_label))
        self.play(cart.animate.shift(RIGHT * 1.4), Create(accel_arrow), FadeIn(accel_label))
        self.play(formula.animate.set_color(YELLOW).scale(1.08))
        self.wait(1)


class QuadraticFormulaScene(Scene):
    def construct(self) -> None:
        title = label("Quadratic Formula", 42, YELLOW).to_edge(UP)
        standard = label("ax^2 + bx + c = 0", 44).next_to(title, DOWN, buff=0.5)
        identify = label("Step 1: identify a, b, c", 30, BLUE).next_to(standard, DOWN, buff=0.55)
        discriminant = label("Step 2: compute b^2 - 4ac", 30, ORANGE).next_to(identify, DOWN, buff=0.35)
        solution = label("x = (-b +/- sqrt(b^2 - 4ac)) / 2a", 30, GREEN).next_to(discriminant, DOWN, buff=0.45)

        self.play(Write(title), Write(standard))
        self.play(FadeIn(identify, shift=UP * 0.25))
        self.play(FadeIn(discriminant, shift=UP * 0.25))
        self.play(FadeIn(solution, shift=UP * 0.25))
        self.play(solution.animate.scale(1.08).set_color(YELLOW))
        self.wait(1)


class PhotosynthesisScene(Scene):
    def construct(self) -> None:
        title = label("Photosynthesis", 42, YELLOW).to_edge(UP)
        sun = Circle(radius=0.55, color=YELLOW, fill_opacity=0.8).shift(LEFT * 3 + UP * 1.3)
        leaf = VGroup(
            Circle(radius=0.75, color=GREEN).scale([1.4, 0.7, 1]),
            Line(ORIGIN + LEFT * 0.8, ORIGIN + RIGHT * 0.8, color=GREEN),
        ).shift(DOWN * 0.3)
        co2 = label("CO2", 32, BLUE).shift(LEFT * 3 + DOWN * 1.1)
        water = label("H2O", 32, BLUE).shift(RIGHT * 3 + DOWN * 1.1)
        glucose = label("glucose", 30, GREEN).shift(RIGHT * 2.6 + UP * 1.0)
        oxygen = label("O2", 32, ORANGE).shift(RIGHT * 3 + UP * 0.1)

        self.play(Write(title))
        self.play(Create(sun), Create(leaf))
        self.play(FadeIn(co2), FadeIn(water))
        self.play(Create(Arrow(sun.get_bottom(), leaf.get_top(), color=YELLOW, buff=0.1)))
        self.play(Create(Arrow(co2.get_right(), leaf.get_left(), color=BLUE, buff=0.1)))
        self.play(Create(Arrow(water.get_left(), leaf.get_right(), color=BLUE, buff=0.1)))
        self.play(FadeIn(glucose), FadeIn(oxygen))
        self.play(Transform(leaf.copy(), glucose.copy()), Transform(leaf.copy(), oxygen.copy()))
        self.wait(1)


SCENES = {
    "newton_second_law": NewtonSecondLawScene,
    "quadratic_formula": QuadraticFormulaScene,
    "photosynthesis": PhotosynthesisScene,
}
