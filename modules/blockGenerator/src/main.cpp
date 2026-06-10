#include "blockJson.hpp"

#include <exception>
#include <iostream>

int main(int argc, char* argv[])
{
	const std::string input_path = argc > 1 ? argv[1] : "test_input.json";
	const std::string output_path = argc > 2 ? argv[2] : "test_output.json";

	try
	{
		GeneratorOptions options = readGeneratorOptions(input_path);
		json output = generateBlocksToJson(options);
		writeJsonFile(output_path, output);
		std::cout << "Generated block data written to " << output_path << std::endl;
	}
	catch (const std::exception& e)
	{
		std::cerr << e.what() << std::endl;
		return 1;
	}

	return 0;
}
