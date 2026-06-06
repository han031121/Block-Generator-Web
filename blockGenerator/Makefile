CXX := g++
CXXFLAGS := -std=c++20 -Wall -Wextra
TARGET := blockGenerator.exe
SRCS := main.cpp blockData.cpp

.PHONY: all clean run

all: $(TARGET)

$(TARGET): $(SRCS) blockData.hpp
	$(CXX) $(CXXFLAGS) $(SRCS) -o $(TARGET)

run: $(TARGET)
	./$(TARGET)

clean:
	-del /Q $(TARGET) 2>NUL
