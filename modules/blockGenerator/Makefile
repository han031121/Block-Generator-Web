CXX := g++
CXXFLAGS := -std=c++20 -Wall -Wextra -Iinclude -Iexternal
TARGET := bin/blockGenerator.exe
SRCS := src/main.cpp src/blockData.cpp src/blockJson.cpp
HEADERS := include/blockData.hpp include/blockJson.hpp
INPUT := fixtures/input/test_input.json
OUTPUT := fixtures/output/test_output.json

.PHONY: all clean run

all: $(TARGET)

$(TARGET): $(SRCS) $(HEADERS)
	$(CXX) $(CXXFLAGS) $(SRCS) -o $(TARGET)

run: $(TARGET)
	./$(TARGET) $(INPUT) $(OUTPUT)

clean:
	-del /Q $(TARGET) 2>NUL
