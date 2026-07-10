CXX := g++
EMCC ?= emcc.bat
CXXFLAGS := -std=c++20 -Wall -Wextra -Iinclude -Iexternal
TARGET := bin/blockGenerator.exe
SRCS := src/main.cpp src/blockData.cpp src/blockJson.cpp
WASM_SRCS := src/wasm.cpp src/blockData.cpp src/blockJson.cpp
HEADERS := include/blockData.hpp include/blockJson.hpp
INPUT := fixtures/input/sample_input.json
OUTPUT := fixtures/output/sample_output.json
WASM_OUT_DIR := ../../apps/web/public/generated
WASM_JS := $(WASM_OUT_DIR)/blockGenerator.js

WASM_FLAGS := \
	-sMODULARIZE=1 \
	-sEXPORT_ES6=1 \
	-sENVIRONMENT=web \
	-sEXPORT_NAME=createBlockGeneratorModule \
	-sEXPORTED_FUNCTIONS=['_generate_blocks_json','_free_generated_string'] \
	-sEXPORTED_RUNTIME_METHODS=['UTF8ToString','cwrap'] \
	-sINITIAL_MEMORY=128MB \
	-sFILESYSTEM=0

.PHONY: all clean run wasm wasm-clean

all: $(TARGET)

$(TARGET): $(SRCS) $(HEADERS)
	$(CXX) $(CXXFLAGS) $(SRCS) -o $(TARGET)

$(WASM_OUT_DIR):
	if not exist "$(WASM_OUT_DIR)" mkdir "$(WASM_OUT_DIR)"

$(WASM_JS): $(WASM_SRCS) $(HEADERS) | $(WASM_OUT_DIR)
	$(EMCC) $(CXXFLAGS) $(WASM_SRCS) -o $(WASM_JS) $(WASM_FLAGS)

wasm: $(WASM_JS)

run: $(TARGET)
	./$(TARGET) $(INPUT) $(OUTPUT)

clean:
	-del /Q $(TARGET) 2>NUL

wasm-clean:
	-del /Q "$(WASM_OUT_DIR)\blockGenerator.js" 2>NUL
	-del /Q "$(WASM_OUT_DIR)\blockGenerator.wasm" 2>NUL
