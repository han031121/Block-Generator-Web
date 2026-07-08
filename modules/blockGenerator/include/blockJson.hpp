#pragma once

#include "blockData.hpp"
#include <nlohmann/json.hpp>

#include <string>

using json = nlohmann::json;

struct GeneratorOptions
{
	int generate_count;
	int block_count_min;
	int block_count_max;
	int max_r;
	int max_c;
	int max_h;
	double density;
	bool allow_duplicate;
};

GeneratorOptions readGeneratorOptions(const std::string& input_path);
GeneratorOptions generatorOptionsFromJson(const json& data);
json blockToJson(const blockData& block_data, int index);
json generateBlocksToJson(const GeneratorOptions& options);
json generateBlocksFromJsonText(const std::string& input_json_text);
void writeJsonFile(const std::string& output_path, const json& data);
