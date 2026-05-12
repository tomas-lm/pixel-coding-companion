import AVFoundation
import FluidAudio
import Foundation

struct TranscriptionOutput: Codable {
    let confidence: Float
    let durationMs: Int
    let processingTimeMs: Int
    let text: String
}

struct ErrorOutput: Codable {
    let error: String
}

enum HelperError: Error, LocalizedError {
    case missingArgument(String)
    case unknownCommand(String)

    var errorDescription: String? {
        switch self {
        case .missingArgument(let name):
            return "Missing required argument: \(name)"
        case .unknownCommand(let command):
            return "Unknown command: \(command)"
        }
    }
}

@main
struct PixelDictationHelper {
    static func main() async {
        do {
            let arguments = Array(CommandLine.arguments.dropFirst())
            guard let command = arguments.first else {
                throw HelperError.missingArgument("command")
            }

            switch command {
            case "transcribe":
                try await transcribe(arguments: Array(arguments.dropFirst()))
            default:
                throw HelperError.unknownCommand(command)
            }
        } catch {
            writeError(error)
            Foundation.exit(1)
        }
    }

    private static func transcribe(arguments: [String]) async throws {
        let modelPath = try value(after: "--model-dir", in: arguments)
        let audioPath = try value(after: "--audio", in: arguments)
        let modelURL = URL(fileURLWithPath: modelPath, isDirectory: true)
        let audioURL = URL(fileURLWithPath: audioPath, isDirectory: false)
        let modelVersion = AsrModelVersion.v3

        let models = try await AsrModels.load(
            from: modelURL,
            version: modelVersion,
            encoderPrecision: .int8
        )
        let asrManager = AsrManager(
            config: ASRConfig(
                tdtConfig: TdtConfig(blankId: modelVersion.blankId),
                encoderHiddenSize: modelVersion.encoderHiddenSize
            )
        )
        try await asrManager.loadModels(models)

        var decoderState = TdtDecoderState.make(decoderLayers: await asrManager.decoderLayerCount)
        let result = try await asrManager.transcribe(audioURL, decoderState: &decoderState)
        let output = TranscriptionOutput(
            confidence: result.confidence,
            durationMs: Int((result.duration * 1000).rounded()),
            processingTimeMs: Int((result.processingTime * 1000).rounded()),
            text: result.text.trimmingCharacters(in: .whitespacesAndNewlines)
        )

        try writeJson(output)
    }

    private static func value(after flag: String, in arguments: [String]) throws -> String {
        guard let index = arguments.firstIndex(of: flag), arguments.indices.contains(index + 1) else {
            throw HelperError.missingArgument(flag)
        }

        return arguments[index + 1]
    }

    private static func writeJson<T: Encodable>(_ value: T) throws {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.withoutEscapingSlashes]
        let data = try encoder.encode(value)
        FileHandle.standardOutput.write(data)
        FileHandle.standardOutput.write(Data([0x0A]))
    }

    private static func writeError(_ error: Error) {
        let output = ErrorOutput(error: error.localizedDescription)
        if let data = try? JSONEncoder().encode(output) {
            FileHandle.standardError.write(data)
            FileHandle.standardError.write(Data([0x0A]))
        } else {
            FileHandle.standardError.write(Data(error.localizedDescription.utf8))
            FileHandle.standardError.write(Data([0x0A]))
        }
    }
}
