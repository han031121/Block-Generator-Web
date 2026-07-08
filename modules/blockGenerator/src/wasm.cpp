#include "blockJson.hpp"

#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#endif

#include <cstdlib>
#include <cstring>
#include <exception>
#include <stdexcept>
#include <string>

namespace
{
char* copyToOwnedCString(const std::string& text)
{
    char* result = static_cast<char*>(std::malloc(text.size() + 1));
    if (result == nullptr)
        return nullptr;

    std::memcpy(result, text.c_str(), text.size() + 1);
    return result;
}
}

extern "C"
{
#ifdef __EMSCRIPTEN__
EMSCRIPTEN_KEEPALIVE
#endif
char* generate_blocks_json(const char* input_json_text)
{
    try
    {
        if (input_json_text == nullptr)
            throw std::runtime_error("Input json text is required.");

        json output = generateBlocksFromJsonText(input_json_text);
        return copyToOwnedCString(json{
            {"success", true},
            {"block_json", output}
        }.dump());
    }
    catch (const std::exception& error)
    {
        return copyToOwnedCString(json{
            {"success", false},
            {"error", error.what()}
        }.dump());
    }
}

#ifdef __EMSCRIPTEN__
EMSCRIPTEN_KEEPALIVE
#endif
void free_generated_string(char* value)
{
    std::free(value);
}
}
