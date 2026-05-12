// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "PixelDictationHelper",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .executable(
            name: "pixel-dictation-helper",
            targets: ["PixelDictationHelper"]
        )
    ],
    dependencies: [
        .package(
            url: "https://github.com/FluidInference/FluidAudio.git",
            revision: "847a985ae4091db2eb92733cad1a94a888e6f0cf"
        )
    ],
    targets: [
        .executableTarget(
            name: "PixelDictationHelper",
            dependencies: [
                .product(name: "FluidAudio", package: "FluidAudio")
            ]
        )
    ]
)
